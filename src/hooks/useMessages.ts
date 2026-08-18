import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { messageService, type StartConversationInput } from '@/services/messageService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { Json } from '@/types/database'

export function useConversations(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.list(condominiumId ?? ''),
    queryFn: () => messageService.listConversations(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}


export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId ?? ''),
    queryFn: () => messageService.listMessages(conversationId as string),
    enabled: Boolean(conversationId),
  })
}

/** Realtime: mensajes entrantes de la conversacion abierta. */
export function useMessagesRealtime(conversationId: string | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    return messageService.subscribeToConversation(conversationId, () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
  }, [conversationId, queryClient])
}

export function useMessageMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    void queryClient.invalidateQueries({ queryKey: ['messages'] })
  }

  const startConversation = useMutation({
    mutationFn: (input: StartConversationInput) => messageService.startConversation(input),
    onSuccess: () => {
      notify.success('Conversacion iniciada')
      invalidate()
    },
  })

  const sendMessage = useMutation({
    mutationFn: (input: {
      conversationId: string
      condominiumId: string
      senderId: string
      body: string
      attachments?: Json
    }) => messageService.sendMessage(input),
    onSuccess: invalidate,
  })

  const markRead = useMutation({
    mutationFn: (input: { conversationId: string; userId: string }) =>
      messageService.markConversationRead(input.conversationId, input.userId),
    onSuccess: invalidate,
    meta: { silent: true },
  })

  const archive = useMutation({
    mutationFn: (id: string) => messageService.archiveConversation(id),
    onSuccess: () => {
      notify.success('Conversacion archivada')
      invalidate()
    },
  })

  return { startConversation, sendMessage, markRead, archive }
}
