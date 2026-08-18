import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd'
import { Archive, MessageCirclePlus, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { EmptyState, TableSkeleton } from '@/components/ui/states'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { useAuth } from '@/hooks/useAuth'
import {
  useConversations,
  useMessageMutations,
  useMessages,
  useMessagesRealtime,
} from '@/hooks/useMessages'
import { useAllMembers } from '@/hooks/useMembers'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { conversationSchema, type ConversationFormValues } from '@/schemas/communication'
import { formatDateTime, formatRelative, initials } from '@/utils/format'

const { Text } = Typography

export function MessagesPage() {
  const { currentCondominiumId, user, profile } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  // En movil no caben las dos columnas: se muestra la lista o la conversacion.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')

  const conversationsQuery = useConversations(currentCondominiumId)
  const messagesQuery = useMessages(selectedId)
  const membersQuery = useAllMembers(currentCondominiumId)
  const { startConversation, sendMessage, markRead, archive } = useMessageMutations()

  useMessagesRealtime(selectedId)

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data])
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  useEffect(() => {
    if (selectedId && user?.id) {
      markRead.mutate({ conversationId: selectedId, userId: user.id })
    }
    // markRead es estable dentro del ciclo de vida de la pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesQuery.data])

  const form = useForm<ConversationFormValues>({
    resolver: zodResolver(conversationSchema),
    defaultValues: { subject: '', participant_ids: [], message: '' },
  })

  const submitNew = form.handleSubmit(async (values) => {
    if (!currentCondominiumId || !user) return
    const conversation = await startConversation.mutateAsync({
      condominiumId: currentCondominiumId,
      subject: values.subject,
      createdBy: user.id,
      participantIds: values.participant_ids,
      firstMessage: values.message,
    })
    form.reset({ subject: '', participant_ids: [], message: '' })
    setNewOpen(false)
    setSelectedId(conversation.id)
  })

  const handleSend = async () => {
    if (!draft.trim() || !selectedId || !currentCondominiumId || !user) return
    await sendMessage.mutateAsync({
      conversationId: selectedId,
      condominiumId: currentCondominiumId,
      senderId: user.id,
      body: draft.trim(),
    })
    setDraft('')
  }

  const unreadCount = (conversationId: string): number => {
    const conversation = conversations.find((item) => item.id === conversationId)
    if (!conversation || !user) return 0
    const participant = conversation.participants.find((item) => item.user_id === user.id)
    if (!participant) return 0
    return conversation.messages.filter(
      (message) =>
        message.sender_id !== user.id &&
        (!participant.last_read_at || message.created_at > participant.last_read_at),
    ).length
  }

  const memberOptions = (membersQuery.data ?? [])
    .filter((member) => member.profile && member.profile.id !== user?.id)
    .map((member) => ({
      value: member.profile?.id ?? '',
      label: `${member.profile?.full_name ?? ''} · ${member.role?.name ?? ''}`,
    }))
    .filter(
      (option, index, list) =>
        list.findIndex((candidate) => candidate.value === option.value) === index,
    )

  return (
    <>
      <PageHeader
        title="Mensajes"
        subtitle="Canal directo entre residentes y la administracion."
        actions={
          <Button
            type="primary"
            icon={<MessageCirclePlus size={16} />}
            onClick={() => setNewOpen(true)}
          >
            Nueva conversacion
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col
          xs={24}
          lg={8}
          xl={7}
          className={isMobile && mobileView === 'chat' ? 'hidden' : undefined}
        >
          <Card
            className="surface-card"
            title={<span className="text-sm font-semibold">Conversaciones</span>}
            styles={{ body: { padding: 0, maxHeight: isMobile ? '55vh' : 620, overflowY: 'auto' } }}
          >
            {conversationsQuery.isLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                title="Sin conversaciones"
                description="Inicia una conversacion con la administracion."
              />
            ) : (
              <List
                dataSource={conversations}
                renderItem={(conversation) => {
                  const unread = unreadCount(conversation.id)
                  const last = conversation.messages[conversation.messages.length - 1]
                  return (
                    <List.Item
                      className={`!px-4 !py-3 cursor-pointer transition-colors ${
                        conversation.id === selectedId ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setSelectedId(conversation.id)
                        if (isMobile) setMobileView('chat')
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Badge count={unread} size="small">
                            <Avatar style={{ backgroundColor: '#2559eb' }}>
                              {initials(conversation.subject)}
                            </Avatar>
                          </Badge>
                        }
                        title={
                          <span className="text-sm font-medium text-slate-800">
                            {conversation.subject}
                          </span>
                        }
                        description={
                          <div>
                            <p className="m-0 truncate text-xs text-slate-500">
                              {last?.body ?? 'Sin mensajes'}
                            </p>
                            <span className="text-[11px] text-slate-400">
                              {formatRelative(conversation.last_message_at)}
                            </span>
                          </div>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Col>

        <Col
          xs={24}
          lg={16}
          xl={17}
          className={isMobile && mobileView === 'list' ? 'hidden' : undefined}
        >
          <Card
            className="surface-card flex flex-col"
            styles={{
              body: {
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                height: isMobile ? 'calc(100dvh - 260px)' : 620,
                minHeight: 320,
              },
            }}
            title={
              selected ? (
                <div>
                  <p className="m-0 text-sm font-semibold text-slate-800">{selected.subject}</p>
                  <Space size={4} wrap>
                    {selected.participants.map((participant) => (
                      <Tag key={participant.user_id} bordered={false}>
                        {participant.profile?.full_name ?? 'Usuario'}
                      </Tag>
                    ))}
                  </Space>
                </div>
              ) : (
                <span className="text-sm font-semibold">Selecciona una conversacion</span>
              )
            }
            extra={
              selected ? (
                <Space size={4}>
                  {isMobile ? (
                    <Button size="small" onClick={() => setMobileView('list')}>
                      Volver
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    icon={<Archive size={14} />}
                    onClick={() => {
                      void archive.mutateAsync(selected.id).then(() => setSelectedId(null))
                    }}
                  >
                    Archivar
                  </Button>
                </Space>
              ) : null
            }
          >
            {!selected ? (
              <div className="flex flex-1 items-center justify-center">
                <Empty description="Selecciona o crea una conversacion" />
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messagesQuery.isLoading ? (
                    <TableSkeleton rows={4} />
                  ) : (
                    (messagesQuery.data ?? []).map((message) => {
                      const mine = message.sender_id === user?.id
                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`flex max-w-[80%] gap-2 ${mine ? 'flex-row-reverse' : ''}`}
                          >
                            <Avatar
                              size={30}
                              src={message.sender?.avatar_url ?? undefined}
                              style={{ backgroundColor: mine ? '#2559eb' : '#94a3b8' }}
                            >
                              {initials(mine ? profile?.full_name : message.sender?.full_name)}
                            </Avatar>
                            <div
                              className={`rounded-xl px-3 py-2 ${
                                mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <p className="m-0 whitespace-pre-wrap text-sm">{message.body}</p>
                              <span
                                className={`text-[10px] ${mine ? 'text-blue-100' : 'text-slate-500'}`}
                              >
                                {formatDateTime(message.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-slate-100 p-3">
                  <Space.Compact className="w-full">
                    <Input.TextArea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Escribe un mensaje..."
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      onPressEnter={(event) => {
                        if (!event.shiftKey) {
                          event.preventDefault()
                          void handleSend()
                        }
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<Send size={15} />}
                      loading={sendMessage.isPending}
                      disabled={!draft.trim()}
                      onClick={() => void handleSend()}
                    >
                      Enviar
                    </Button>
                  </Space.Compact>
                  <Text type="secondary" className="mt-1 block text-[11px]">
                    Enter para enviar · Shift + Enter para salto de linea
                  </Text>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <FormDrawer
        open={newOpen}
        title="Nueva conversacion"
        description="Selecciona los destinatarios y escribe el primer mensaje."
        onClose={() => setNewOpen(false)}
        onSubmit={() => void submitNew()}
        submitting={startConversation.isPending}
        submitLabel="Iniciar"
      >
        <form onSubmit={submitNew} noValidate>
          <TextField control={form.control} name="subject" label="Asunto" required />
          <SelectField
            control={form.control}
            name="participant_ids"
            label="Destinatarios"
            required
            mode="multiple"
            loading={membersQuery.isLoading}
            options={memberOptions}
          />
          <TextAreaField control={form.control} name="message" label="Mensaje" required rows={5} />
        </form>
      </FormDrawer>
    </>
  )
}
