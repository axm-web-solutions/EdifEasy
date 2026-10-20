import { describe, expect, it } from 'vitest'
import type { SurveyWithQuestions } from '@/services/surveyService'
import {
  EMPTY_DRAFT,
  filterSurveys,
  formToDraft,
  surveyToForm,
  toBallot,
  toResultsView,
  toSurveyView,
  validateBallot,
} from './surveys.logic'

const NOW = Date.parse('2026-10-19T12:00:00Z')

const survey = (overrides: Partial<SurveyWithQuestions> = {}): SurveyWithQuestions => ({
  id: 's1',
  condominium_id: 'c',
  title: 'Pintura de fachada',
  description: null,
  status: 'OPEN',
  vote_scope: 'UNIT',
  anonymous: false,
  show_results: true,
  closes_at: null,
  opened_at: null,
  closed_at: null,
  created_by: 'u9',
  created_at: '',
  updated_at: '',
  questions: [
    {
      id: 'q1',
      survey_id: 's1',
      position: 0,
      text: 'Color?',
      multiple: false,
      options: [
        { id: 'o1', question_id: 'q1', position: 0, text: 'Blanco' },
        { id: 'o2', question_id: 'q1', position: 1, text: 'Gris' },
      ],
    },
    {
      id: 'q2',
      survey_id: 's1',
      position: 1,
      text: 'Extras?',
      multiple: true,
      options: [
        { id: 'o3', question_id: 'q2', position: 0, text: 'Barandas' },
        { id: 'o4', question_id: 'q2', position: 1, text: 'Porteria' },
      ],
    },
  ],
  ...overrides,
})

const resident = { canManage: false, voted: new Set<string>(), now: NOW }
const admin = { canManage: true, voted: new Set<string>(), now: NOW }

describe('encuestas', () => {
  it('permisos segun estado y voto', () => {
    const open = toSurveyView(survey(), resident)
    expect(open.canVote).toBe(true)
    expect(open.canSeeResults).toBe(false)
    expect(open.meta).toBe('Un voto por apartamento')

    const voted = toSurveyView(survey(), { ...resident, voted: new Set(['s1']) })
    expect(voted.canVote).toBe(false)
    expect(voted.canSeeResults).toBe(true)

    const hidden = toSurveyView(survey({ show_results: false, status: 'CLOSED' }), resident)
    expect(hidden.canSeeResults).toBe(false)
    expect(toSurveyView(survey({ show_results: false }), admin).canSeeResults).toBe(true)

    const draft = toSurveyView(survey({ status: 'DRAFT' }), admin)
    expect([draft.canEdit, draft.canOpen, draft.canClose, draft.canVote]).toEqual([
      true,
      true,
      false,
      false,
    ])
  })

  it('una abierta con fecha vencida se ve cerrada', () => {
    const view = toSurveyView(survey({ closes_at: '2026-10-18T23:59:59Z' }), resident)
    expect(view.status).toBe('CLOSED')
    expect(view.canVote).toBe(false)
    expect(view.meta).toMatch(/cerro el/)
    expect(filterSurveys([view], 'closed')).toHaveLength(1)
    expect(filterSurveys([view], 'open')).toHaveLength(0)
  })

  it('valida y arma la papeleta', () => {
    const s = survey()
    expect(validateBallot(s, { q1: ['o1'] })).toBe('Responde la pregunta 2')
    expect(validateBallot(s, { q1: ['o1'], q2: ['o3', 'o4'] })).toBeNull()
    expect(toBallot(s, { q1: ['o1', 'o2'], q2: ['o3', 'o4'] })).toEqual([
      { question_id: 'q1', option_ids: ['o1'] },
      { question_id: 'q2', option_ids: ['o3', 'o4'] },
    ])
  })

  it('resultados con porcentaje, lider y participacion', () => {
    const view = toResultsView(survey(), {
      hidden: false,
      ballots: 4,
      eligible_units: 10,
      questions: [
        {
          question_id: 'q1',
          options: [
            { option_id: 'o1', votes: 3 },
            { option_id: 'o2', votes: 1 },
          ],
        },
      ],
    })
    expect(view.ballotsLabel).toBe('4 votos · 40% de los apartamentos')
    expect(view.questions[0].options.map((o) => [o.percent, o.leading])).toEqual([
      [75, true],
      [25, false],
    ])
    expect(view.questions[1].options.every((o) => o.votes === 0 && !o.leading)).toBe(true)
  })

  it('ida y vuelta del formulario', () => {
    const draft = formToDraft({ ...EMPTY_DRAFT, title: 'Horario piscina', closes_on: '2026-10-25' })
    expect(draft.questions[0].options).toEqual(['Si', 'No'])
    expect(draft.description).toBeNull()
    expect(new Date(draft.closes_at as string).getDate()).toBe(25)
    expect(surveyToForm(survey()).questions[1].options).toEqual([
      { text: 'Barandas' },
      { text: 'Porteria' },
    ])
  })
})
