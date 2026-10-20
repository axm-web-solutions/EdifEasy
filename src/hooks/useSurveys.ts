import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { surveyService, type SurveyDraftInput } from '@/services/surveyService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'

export function useSurveys(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.surveys.list(condominiumId ?? ''),
    queryFn: () => surveyService.list(condominiumId as string),
    enabled: Boolean(condominiumId),
  })
}

export function useMySurveyBallots(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.surveys.ballots(userId ?? ''),
    queryFn: () => surveyService.myBallots(userId as string),
    enabled: Boolean(userId),
  })
}

export function useSurveyResults(surveyId: string | null) {
  return useQuery({
    queryKey: queryKeys.surveys.results(surveyId ?? ''),
    queryFn: () => surveyService.results(surveyId as string),
    enabled: Boolean(surveyId),
  })
}

export function useSurveyMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['surveys'] })
  const done = (message: string) => () => {
    notify.success(message)
    invalidate()
  }
  return {
    create: useMutation({
      mutationFn: ({ condominiumId, input }: { condominiumId: string; input: SurveyDraftInput }) =>
        surveyService.createDraft(condominiumId, input),
      onSuccess: done('Encuesta guardada como borrador'),
    }),
    update: useMutation({
      mutationFn: ({ surveyId, input }: { surveyId: string; input: SurveyDraftInput }) =>
        surveyService.updateDraft(surveyId, input),
      onSuccess: done('Borrador actualizado'),
    }),
    remove: useMutation({
      mutationFn: (surveyId: string) => surveyService.removeDraft(surveyId),
      onSuccess: done('Borrador eliminado'),
    }),
    open: useMutation({
      mutationFn: (surveyId: string) => surveyService.setStatus(surveyId, 'OPEN'),
      onSuccess: done('Encuesta abierta: ya pueden votar'),
    }),
    close: useMutation({
      mutationFn: (surveyId: string) => surveyService.setStatus(surveyId, 'CLOSED'),
      onSuccess: done('Encuesta cerrada'),
    }),
    vote: useMutation({
      mutationFn: ({
        surveyId,
        answers,
      }: {
        surveyId: string
        answers: { question_id: string; option_ids: string[] }[]
      }) => surveyService.vote(surveyId, answers),
      onSuccess: done('Gracias, tu voto quedo registrado'),
    }),
  }
}
