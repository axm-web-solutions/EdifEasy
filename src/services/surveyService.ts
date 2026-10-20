/**
 * Encuestas. Las preguntas y opciones solo se editan en borrador; abrir,
 * cerrar, votar y ver resultados van por RPC (nadie lee votos ajenos).
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type {
  SurveyOptionRow,
  SurveyQuestionRow,
  SurveyRow,
  SurveyScope,
  SurveyStatus,
} from '@/types/database'

export interface SurveyWithQuestions extends SurveyRow {
  questions: (SurveyQuestionRow & { options: SurveyOptionRow[] })[]
}

export interface SurveyResults {
  hidden: boolean
  ballots: number
  eligible_units?: number
  questions?: { question_id: string; options: { option_id: string; votes: number }[] }[]
}

export interface SurveyDraftInput {
  title: string
  description: string | null
  vote_scope: SurveyScope
  anonymous: boolean
  show_results: boolean
  closes_at: string | null
  questions: { text: string; multiple: boolean; options: string[] }[]
}

const SELECT = '*, questions:survey_questions(*, options:survey_options(*))'

function sortSurvey(survey: SurveyWithQuestions): SurveyWithQuestions {
  return {
    ...survey,
    questions: [...survey.questions]
      .sort((a, b) => a.position - b.position)
      .map((question) => ({
        ...question,
        options: [...question.options].sort((a, b) => a.position - b.position),
      })),
  }
}

async function writeQuestions(surveyId: string, questions: SurveyDraftInput['questions']) {
  if (questions.length === 0) return
  const { data, error } = await supabase
    .from('survey_questions')
    .insert(
      questions.map((question, index) => ({
        survey_id: surveyId,
        position: index,
        text: question.text,
        multiple: question.multiple,
      })),
    )
    .select('id, position')
  if (error) throw toAppError(error)
  const byPosition = new Map(data.map((row) => [row.position, row.id]))
  const options = questions.flatMap((question, index) =>
    question.options.map((text, position) => ({
      question_id: byPosition.get(index) as string,
      position,
      text,
    })),
  )
  if (options.length === 0) return
  const { error: optionsError } = await supabase.from('survey_options').insert(options)
  if (optionsError) throw toAppError(optionsError)
}

export const surveyService = {
  async list(condominiumId: string): Promise<SurveyWithQuestions[]> {
    const { data, error } = await supabase
      .from('surveys')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<SurveyWithQuestions[]>()
    if (error) throw toAppError(error)
    return data.map(sortSurvey)
  },

  /** Encuestas en las que la persona ya voto. */
  async myBallots(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('survey_ballots')
      .select('survey_id')
      .eq('voter_id', userId)
    if (error) throw toAppError(error)
    return data.map((row) => row.survey_id)
  },

  async createDraft(condominiumId: string, input: SurveyDraftInput): Promise<string> {
    const { questions, ...fields } = input
    const { data, error } = await supabase
      .from('surveys')
      .insert({ ...fields, condominium_id: condominiumId })
      .select('id')
      .single()
    if (error) throw toAppError(error)
    try {
      await writeQuestions(data.id, questions)
    } catch (questionsError) {
      await supabase.from('surveys').delete().eq('id', data.id)
      throw questionsError
    }
    return data.id
  },

  /** Reemplaza el borrador completo (datos, preguntas y opciones). */
  async updateDraft(surveyId: string, input: SurveyDraftInput): Promise<void> {
    const { questions, ...fields } = input
    const { error } = await supabase.from('surveys').update(fields).eq('id', surveyId)
    if (error) throw toAppError(error)
    const { error: deleteError } = await supabase
      .from('survey_questions')
      .delete()
      .eq('survey_id', surveyId)
    if (deleteError) throw toAppError(deleteError)
    await writeQuestions(surveyId, questions)
  },

  async removeDraft(surveyId: string): Promise<void> {
    const { error } = await supabase.from('surveys').delete().eq('id', surveyId)
    if (error) throw toAppError(error)
  },

  async setStatus(surveyId: string, status: Exclude<SurveyStatus, 'DRAFT'>): Promise<string> {
    const { data, error } = await supabase.rpc('set_survey_status', {
      p_survey: surveyId,
      p_status: status,
    })
    if (error) throw toAppError(error)
    return data
  },

  async vote(
    surveyId: string,
    answers: { question_id: string; option_ids: string[] }[],
  ): Promise<number> {
    const { data, error } = await supabase.rpc('submit_survey_vote', {
      p_survey: surveyId,
      p_answers: answers,
    })
    if (error) throw toAppError(error)
    return data
  },

  async results(surveyId: string): Promise<SurveyResults> {
    const { data, error } = await supabase.rpc('survey_results', { p_survey: surveyId })
    if (error) throw toAppError(error)
    return data as unknown as SurveyResults
  },
}
