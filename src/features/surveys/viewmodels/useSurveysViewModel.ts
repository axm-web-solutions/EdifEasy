import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useMySurveyBallots,
  useSurveyMutations,
  useSurveyResults,
  useSurveys,
} from '@/hooks/useSurveys'
import { getErrorMessage } from '@/lib/errors'
import {
  filterSurveys,
  toBallot,
  toResultsView,
  toSurveyView,
  validateBallot,
  type SurveyFilter,
} from './surveys.logic'

/**
 * Encuestas: la administracion y el vocero las crean en borrador, las abren y
 * las cierran; los residentes (y el resto de miembros) votan y ven resultados
 * cuando la encuesta lo permite.
 */
export function useSurveysViewModel() {
  const { currentCondominiumId, hasRole, user } = useAuth()
  const canManage = hasRole(['ADMINISTRATOR', 'SPOKESPERSON', 'SUPER_ADMIN'])

  const listQuery = useSurveys(currentCondominiumId)
  const ballotsQuery = useMySurveyBallots(user?.id ?? null)
  const mutations = useSurveyMutations()

  const [filter, setFilter] = useState<SurveyFilter>('open')
  const voted = useMemo(() => new Set(ballotsQuery.data ?? []), [ballotsQuery.data])
  const surveys = useMemo(() => listQuery.data ?? [], [listQuery.data])
  const views = useMemo(
    () => surveys.map((survey) => toSurveyView(survey, { canManage, voted })),
    [surveys, canManage, voted],
  )
  const visible = useMemo(() => filterSurveys(views, filter), [views, filter])
  const counts = useMemo(
    () => ({
      open: filterSurveys(views, 'open').length,
      pending: filterSurveys(views, 'open').filter((view) => view.canVote).length,
      drafts: filterSurveys(views, 'drafts').length,
    }),
    [views],
  )

  // ------------------------------------------------------------- votacion
  const [votingId, setVotingId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [ballotError, setBallotError] = useState<string | null>(null)
  const voting = surveys.find((survey) => survey.id === votingId) ?? null

  const openVote = (id: string) => {
    setVotingId(id)
    setAnswers({})
    setBallotError(null)
    mutations.vote.reset()
  }

  const submitVote = () => {
    if (!voting) return
    const error = validateBallot(voting, answers)
    setBallotError(error)
    if (error) return
    mutations.vote.mutate(
      { surveyId: voting.id, answers: toBallot(voting, answers) },
      { onSuccess: () => setVotingId(null) },
    )
  }

  // ----------------------------------------------------------- resultados
  const [resultsId, setResultsId] = useState<string | null>(null)
  const resultsQuery = useSurveyResults(resultsId)
  const resultsSurvey = surveys.find((survey) => survey.id === resultsId) ?? null
  const results =
    resultsSurvey && resultsQuery.data ? toResultsView(resultsSurvey, resultsQuery.data) : null

  let status: 'loading' | 'error' | 'empty' | 'ready'
  if (listQuery.isLoading) status = 'loading'
  else if (listQuery.isError) status = 'error'
  else if (visible.length === 0) status = 'empty'
  else status = 'ready'

  return {
    canManage,
    status,
    retry: () => void listQuery.refetch(),
    surveys: visible,
    filter,
    setFilter,
    filterOptions: [
      {
        value: 'open',
        label: counts.pending > 0 ? `Abiertas (${counts.pending} por votar)` : 'Abiertas',
      },
      { value: 'closed', label: 'Cerradas' },
      ...(canManage
        ? [
            {
              value: 'drafts',
              label: counts.drafts > 0 ? `Borradores (${counts.drafts})` : 'Borradores',
            },
          ]
        : []),
    ],
    emptyText:
      filter === 'open'
        ? canManage
          ? 'No hay encuestas abiertas. Crea una y abrela para que voten.'
          : 'No hay encuestas abiertas en este momento.'
        : filter === 'drafts'
          ? 'No tienes borradores.'
          : 'Aun no hay encuestas cerradas.',

    // acciones de la administracion
    open: (id: string) => mutations.open.mutate(id),
    close: (id: string) => mutations.close.mutate(id),
    remove: (id: string) => mutations.remove.mutate(id),
    busyId:
      (mutations.open.isPending && mutations.open.variables) ||
      (mutations.close.isPending && mutations.close.variables) ||
      null,

    // votacion
    voting: voting
      ? {
          title: voting.title,
          description: voting.description,
          anonymous: voting.anonymous,
          scopeNote:
            voting.vote_scope === 'UNIT'
              ? 'Se registra un voto por apartamento: el primero que vote cuenta.'
              : 'Tu voto es personal.',
          questions: voting.questions.map((question) => ({
            id: question.id,
            text: question.text,
            multiple: question.multiple,
            options: question.options.map((option) => ({ value: option.id, label: option.text })),
            selected: answers[question.id] ?? [],
          })),
        }
      : null,
    openVote,
    closeVote: () => setVotingId(null),
    answer: (questionId: string, optionIds: string[]) =>
      setAnswers((current) => ({ ...current, [questionId]: optionIds })),
    submitVote,
    submittingVote: mutations.vote.isPending,
    voteError: ballotError ?? (mutations.vote.error ? getErrorMessage(mutations.vote.error) : null),

    // resultados
    resultsOpen: Boolean(resultsId),
    resultsTitle: resultsSurvey?.title ?? '',
    results,
    resultsLoading: resultsQuery.isLoading,
    resultsError: resultsQuery.isError ? getErrorMessage(resultsQuery.error) : null,
    openResults: (id: string) => setResultsId(id),
    closeResults: () => setResultsId(null),
  }
}

export type SurveysViewModel = ReturnType<typeof useSurveysViewModel>
