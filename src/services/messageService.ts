import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, DB_SCHEMA } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { ConversationRow, Json, MessageRow } from '@/types/database'
import type { ConversationWithRelations, MessageWithSender } from '@/types/models'

const CONVERSATION_SELECT = `
  *,
  participants:conversation_participants(
    user_id,
    last_read_at,
    profile:profiles(id, full_name, email, avatar_url, phone)
  ),
  messages(id, body, created_at, sender_id)
`

const MESSAGE_SELECT = `
  *,
  sender:profiles!messages_sender_id_fkey(id, full_name, email, avatar_url, phone)
`

export interface StartConversationInput {
  condominiumId: string
  subject: string
  createdBy: string
  participantIds: string[]
  firstMessage: string
}

export const messageService = {
  async listConversations(condominiumId: string): Promise<ConversationWithRelations[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('condominium_id', condominiumId)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .returns<ConversationWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async getConversation(id: string): Promise<ConversationWithRelations | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', id)
      .returns<ConversationWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async listMessages(conversationId: string): Promise<MessageWithSender[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .returns<MessageWithSender[]>()
    if (error) throw toAppError(error)
    return data
  },

  async startConversation(input: StartConversationInput): Promise<ConversationRow> {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        condominium_id: input.condominiumId,
        subject: input.subject,
        type: 'SUPPORT',
        created_by: input.createdBy,
      })
      .select('*')
      .single()
    if (error) throw toAppError(error)

    const participants = Array.from(new Set([input.createdBy, ...input.participantIds])).map(
      (userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
        last_read_at: userId === input.createdBy ? new Date().toISOString() : null,
      }),
    )

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participants)
    if (participantsError) throw toAppError(participantsError)

    await messageService.sendMessage({
      conversationId: conversation.id,
      condominiumId: input.condominiumId,
      senderId: input.createdBy,
      body: input.firstMessage,
    })

    return conversation
  },

  async sendMessage(input: {
    conversationId: string
    condominiumId: string
    senderId: string
    body: string
    attachments?: Json
  }): Promise<MessageRow> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        condominium_id: input.condominiumId,
        sender_id: input.senderId,
        body: input.body,
        attachments: input.attachments ?? [],
      })
      .select('*')
      .single()
    if (error) throw toAppError(error)

    await supabase.from('audit_logs').insert({
      user_id: input.senderId,
      condominium_id: input.condominiumId,
      action: 'MESSAGE_SENT',
      entity: 'messages',
      entity_id: data.id,
      metadata: { conversation_id: input.conversationId },
    })

    return data
  },

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) throw toAppError(error)
  },

  async archiveConversation(id: string): Promise<void> {
    const { error } = await supabase.from('conversations').update({ is_archived: true }).eq('id', id)
    if (error) throw toAppError(error)
  },

  /** Realtime: mensajes nuevos de una conversacion. */
  subscribeToConversation(
    conversationId: string,
    onInsert: (message: MessageRow) => void,
  ): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: DB_SCHEMA,
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onInsert(payload.new as MessageRow)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
