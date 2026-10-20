import type { SurveyDraftInput, SurveyResults, SurveyWithQuestions } from '@/services/surveyService'
import type { SurveyDraftFormValues } from '@/schemas/surveys'
import type { SurveyStatus } from '@/types/database'
import { formatDate } from '@/utils/format'

const STATUS: Record<SurveyStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'default' },
  OPEN: { label: 'Abierta', color: 'green' },
  CLOSED: { label: 'Cerrada', color: 'blue' },
}

export type SurveyFilter = 'open' | 'closed' | 'drafts'

export interface SurveyView {
  id: string
  title: string
  description: string | null
  status: SurveyStatus
  statusLabel: string
  statusColor: string
  meta: string
  questionCount: number
  voted: boolean
  expired: boolean
  canVote: boolean
  canEdit: boolean
  canOpen: boolean
  canClose: boolean
  canSeeResults: boolean
}

/** Cierre automatico: la fecha se guarda como fin del dia (hora local). */
export function closesAtFromDay(day: string | null): string | null {
  if (!day) return null
  return new Date(`${day}T23:59:59`).toISOString()
}

export function dayFromClosesAt(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function toSurveyView(
  survey: SurveyWithQuestions,
  ctx: { canManage: boolean; voted: Set<string>; now?: number },
): SurveyView {
  const now = ctx.now ?? Date.now()
  const voted = ctx.voted.has(survey.id)
  const expired = Boolean(survey.closes_at && Date.parse(survey.closes_at) <= now)
  const open = survey.status === 'OPEN' && !expired
  const parts = [
    survey.vote_scope === 'UNIT' ? 'Un voto por apartamento' : 'Un voto por persona',
    survey.anonymous ? 'anonima' : null,
    survey.closes_at ? `${expired ? 'cerro' : 'cierra'} el ${formatDate(survey.closes_at)}` : null,
  ].filter(Boolean)

  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    status: expired && survey.status === 'OPEN' ? 'CLOSED' : survey.status,
    statusLabel: expired && survey.status === 'OPEN' ? 'Cerrada' : STATUS[survey.status].label,
    statusColor: expired && survey.status === 'OPEN' ? 'blue' : STATUS[survey.status].color,
    meta: parts.join(' · '),
    questionCount: survey.questions.length,
    voted,
    expired,
    canVote: open && !voted,
    canEdit: ctx.canManage && survey.status === 'DRAFT',
    canOpen: ctx.canManage && survey.status === 'DRAFT',
    canClose: ctx.canManage && survey.status === 'OPEN',
    canSeeResults:
      survey.status !== 'DRAFT' && (ctx.canManage || (survey.show_results && (voted || !open))),
  }
}

export function filterSurveys(views: SurveyView[], filter: SurveyFilter) {
  if (filter === 'drafts') return views.filter((view) => view.status === 'DRAFT')
  if (filter === 'closed') return views.filter((view) => view.status === 'CLOSED')
  return views.filter((view) => view.status === 'OPEN')
}

/** Error de la papeleta o null si se puede enviar. */
export function validateBallot(
  survey: SurveyWithQuestions,
  answers: Record<string, string[]>,
): string | null {
  const missing = survey.questions.findIndex(
    (question) => (answers[question.id] ?? []).length === 0,
  )
  if (missing >= 0) return `Responde la pregunta ${missing + 1}`
  return null
}

export function toBallot(survey: SurveyWithQuestions, answers: Record<string, string[]>) {
  return survey.questions.map((question) => ({
    question_id: question.id,
    option_ids: question.multiple
      ? (answers[question.id] ?? [])
      : (answers[question.id] ?? []).slice(0, 1),
  }))
}

export interface ResultsView {
  hidden: boolean
  ballotsLabel: string
  participation: number | null
  questions: {
    id: string
    text: string
    options: { id: string; text: string; votes: number; percent: number; leading: boolean }[]
  }[]
}

export function toResultsView(survey: SurveyWithQuestions, results: SurveyResults): ResultsView {
  const ballots = results.ballots
  const participation =
    survey.vote_scope === 'UNIT' && results.eligible_units
      ? Math.round((ballots / results.eligible_units) * 100)
      : null
  return {
    hidden: results.hidden,
    ballotsLabel:
      `${ballots} ${ballots === 1 ? 'voto' : 'votos'}` +
      (participation !== null ? ` · ${participation}% de los apartamentos` : ''),
    participation,
    questions: survey.questions.map((question) => {
      const counts = new Map(
        (results.questions?.find((item) => item.question_id === question.id)?.options ?? []).map(
          (option) => [option.option_id, option.votes],
        ),
      )
      const total = question.options.reduce((sum, option) => sum + (counts.get(option.id) ?? 0), 0)
      const max = Math.max(0, ...question.options.map((option) => counts.get(option.id) ?? 0))
      return {
        id: question.id,
        text: question.text,
        options: question.options.map((option) => {
          const votes = counts.get(option.id) ?? 0
          return {
            id: option.id,
            text: option.text,
            votes,
            percent: total > 0 ? Math.round((votes / total) * 100) : 0,
            leading: max > 0 && votes === max,
          }
        }),
      }
    }),
  }
}

export const EMPTY_DRAFT: SurveyDraftFormValues = {
  title: '',
  description: '',
  vote_scope: 'PERSON',
  anonymous: false,
  show_results: true,
  closes_on: null,
  questions: [{ text: '', multiple: false, options: [{ text: 'Si' }, { text: 'No' }] }],
}

export function surveyToForm(survey: SurveyWithQuestions): SurveyDraftFormValues {
  return {
    title: survey.title,
    description: survey.description ?? '',
    vote_scope: survey.vote_scope,
    anonymous: survey.anonymous,
    show_results: survey.show_results,
    closes_on: dayFromClosesAt(survey.closes_at),
    questions: survey.questions.map((question) => ({
      text: question.text,
      multiple: question.multiple,
      options: question.options.map((option) => ({ text: option.text })),
    })),
  }
}

export function formToDraft(values: SurveyDraftFormValues): SurveyDraftInput {
  return {
    title: values.title,
    description: values.description || null,
    vote_scope: values.vote_scope,
    anonymous: values.anonymous,
    show_results: values.show_results,
    closes_at: closesAtFromDay(values.closes_on || null),
    questions: values.questions.map((question) => ({
      text: question.text,
      multiple: question.multiple,
      options: question.options.map((option) => option.text),
    })),
  }
}
