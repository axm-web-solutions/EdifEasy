import type { GuardLogEntryWithRelations } from '@/services/logbookService'
import type { GuardLogCategory, GuardLogPriority } from '@/types/database'
import { formatDateTime } from '@/utils/format'

export const CATEGORY_LABELS: Record<GuardLogCategory, string> = {
  TURNO_INICIO: 'Inicio de turno',
  TURNO_FIN: 'Fin de turno',
  RONDA: 'Ronda',
  NOVEDAD: 'Novedad',
  VISITANTE: 'Visitante',
  PAQUETE: 'Paquete',
  MANTENIMIENTO: 'Mantenimiento',
  SEGURIDAD: 'Seguridad',
  OTRO: 'Otro',
}

export const PRIORITY_LABELS: Record<GuardLogPriority, string> = {
  NORMAL: 'Normal',
  IMPORTANTE: 'Importante',
  URGENTE: 'Urgente',
}

const PRIORITY_COLORS: Record<GuardLogPriority, string> = {
  NORMAL: 'default',
  IMPORTANTE: 'gold',
  URGENTE: 'volcano',
}

export type LogbookPeriod = 'today' | '3d' | '7d' | '30d'

const PERIOD_DAYS: Record<LogbookPeriod, number> = { today: 0, '3d': 3, '7d': 7, '30d': 30 }

/** Inicio del periodo (medianoche local de hace N dias), en ISO. */
export function periodStart(period: LogbookPeriod, now = new Date()): string {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - PERIOD_DAYS[period])
  return start.toISOString()
}

export interface LogbookEntryView {
  id: string
  category: GuardLogCategory
  categoryLabel: string
  priority: GuardLogPriority
  priorityLabel: string
  priorityColor: string
  highlighted: boolean
  description: string
  whenLabel: string
  timeLabel: string
  dayKey: string
  authorName: string
  unitLabel: string | null
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function toEntryView(row: GuardLogEntryWithRelations): LogbookEntryView {
  const occurred = new Date(row.occurred_at)
  return {
    id: row.id,
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category],
    priority: row.priority,
    priorityLabel: PRIORITY_LABELS[row.priority],
    priorityColor: PRIORITY_COLORS[row.priority],
    highlighted: row.priority !== 'NORMAL',
    description: row.description,
    whenLabel: formatDateTime(row.occurred_at),
    timeLabel: occurred.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    dayKey: localDayKey(occurred),
    authorName: row.author?.full_name ?? 'Usuario eliminado',
    unitLabel: row.apartment
      ? `${row.apartment.building?.name ? `${row.apartment.building.name} · ` : ''}${row.apartment.number}`
      : null,
  }
}

export interface LogbookFilters {
  category: GuardLogCategory | 'ALL'
  onlyImportant: boolean
  search: string
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function filterEntries(entries: LogbookEntryView[], filters: LogbookFilters) {
  const term = normalize(filters.search.trim())
  return entries.filter(
    (entry) =>
      (filters.category === 'ALL' || entry.category === filters.category) &&
      (!filters.onlyImportant || entry.highlighted) &&
      (!term ||
        normalize(`${entry.description} ${entry.authorName} ${entry.unitLabel ?? ''}`).includes(
          term,
        )),
  )
}

/** Agrupa por dia (ya vienen ordenadas de la mas reciente a la mas antigua). */
export function groupByDay(entries: LogbookEntryView[], now = new Date()) {
  const today = localDayKey(now)
  const yesterday = localDayKey(new Date(now.getTime() - 86_400_000))
  const groups: { key: string; label: string; entries: LogbookEntryView[] }[] = []
  for (const entry of entries) {
    let group = groups.find((item) => item.key === entry.dayKey)
    if (!group) {
      const label =
        entry.dayKey === today
          ? 'Hoy'
          : entry.dayKey === yesterday
            ? 'Ayer'
            : new Date(`${entry.dayKey}T12:00:00`).toLocaleDateString('es-CO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
      group = { key: entry.dayKey, label, entries: [] }
      groups.push(group)
    }
    group.entries.push(entry)
  }
  return groups
}

/** Resumen del periodo: total, urgentes y si el ultimo turno sigue abierto. */
export function summarize(entries: LogbookEntryView[]) {
  const lastShift = entries.find(
    (entry) => entry.category === 'TURNO_INICIO' || entry.category === 'TURNO_FIN',
  )
  const shiftOpen = lastShift?.category === 'TURNO_INICIO'
  return {
    total: entries.length,
    urgent: entries.filter((entry) => entry.priority === 'URGENTE').length,
    shiftOpen,
    shiftOwner: shiftOpen ? (lastShift?.authorName ?? null) : null,
  }
}
