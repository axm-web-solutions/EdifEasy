import { describe, expect, it } from 'vitest'
import type { GuardLogEntryWithRelations } from '@/services/logbookService'
import { filterEntries, groupByDay, periodStart, summarize, toEntryView } from './logbook.logic'

const row = (overrides: Partial<GuardLogEntryWithRelations> = {}): GuardLogEntryWithRelations => ({
  id: 'e1',
  condominium_id: 'c',
  category: 'NOVEDAD',
  priority: 'NORMAL',
  description: 'Se fundio la luz del parqueadero',
  apartment_id: null,
  occurred_at: '2026-10-19T15:00:00Z',
  attachments: [],
  created_by: 'u1',
  created_at: '',
  author: { id: 'u1', full_name: 'Carlos Gomez' },
  apartment: null,
  ...overrides,
})

describe('minuta', () => {
  it('arma la vista con apartamento y prioridad', () => {
    const view = toEntryView(
      row({
        priority: 'URGENTE',
        apartment: { id: 'a', number: '301', building: { name: 'Torre 2' } },
      }),
    )
    expect(view.categoryLabel).toBe('Novedad')
    expect(view.highlighted).toBe(true)
    expect(view.priorityColor).toBe('volcano')
    expect(view.unitLabel).toBe('Torre 2 · 301')
  })

  it('filtra por tipo, importancia y texto sin tildes', () => {
    const entries = [
      toEntryView(row({ id: '1', description: 'Paquete de Rappi', category: 'PAQUETE' })),
      toEntryView(row({ id: '2', priority: 'IMPORTANTE', description: 'Puerta electrica' })),
    ]
    const base = { category: 'ALL' as const, onlyImportant: false, search: '' }
    expect(filterEntries(entries, { ...base, category: 'PAQUETE' }).map((e) => e.id)).toEqual(['1'])
    expect(filterEntries(entries, { ...base, onlyImportant: true }).map((e) => e.id)).toEqual(['2'])
    expect(filterEntries(entries, { ...base, search: 'ELÉCTRICA' }).map((e) => e.id)).toEqual(['2'])
  })

  it('agrupa por dia con Hoy y Ayer', () => {
    const now = new Date('2026-10-19T20:00:00')
    const entries = [
      toEntryView(row({ id: '1', occurred_at: new Date('2026-10-19T08:00:00').toISOString() })),
      toEntryView(row({ id: '2', occurred_at: new Date('2026-10-18T08:00:00').toISOString() })),
      toEntryView(row({ id: '3', occurred_at: new Date('2026-10-16T08:00:00').toISOString() })),
    ]
    const groups = groupByDay(entries, now)
    expect(groups.map((g) => g.label).slice(0, 2)).toEqual(['Hoy', 'Ayer'])
    expect(groups).toHaveLength(3)
  })

  it('detecta el turno abierto', () => {
    const entries = [
      toEntryView(row({ id: '2', category: 'RONDA' })),
      toEntryView(row({ id: '1', category: 'TURNO_INICIO', priority: 'URGENTE' })),
    ]
    expect(summarize(entries)).toEqual({
      total: 2,
      urgent: 1,
      shiftOpen: true,
      shiftOwner: 'Carlos Gomez',
    })
    expect(summarize([toEntryView(row({ category: 'TURNO_FIN' }))]).shiftOpen).toBe(false)
  })

  it('el periodo empieza a medianoche', () => {
    const start = new Date(periodStart('3d', new Date('2026-10-19T20:00:00')))
    expect(start.getDate()).toBe(16)
    expect(start.getHours()).toBe(0)
  })
})
