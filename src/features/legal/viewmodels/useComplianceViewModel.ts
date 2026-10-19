import { useEffect, useMemo, useState } from 'react'
import { useDataRequests, useLegalEntity, useLegalMutations } from '@/hooks/useLegal'
import type { DataRequestStatus } from '@/types/database'
import { formatDate } from '@/utils/format'
import { DATA_REQUEST_STATUS, DATA_REQUEST_TYPES } from '../legal.constants'
import { LEGAL_ENTITY_FIELDS, missingEntityFields, type LegalEntity } from '../legal.logic'

/**
 * Cumplimiento (SUPER_ADMIN): datos legales del operador y bandeja de
 * solicitudes de titulares con su plazo legal.
 */
export function useComplianceViewModel() {
  const entityQuery = useLegalEntity()
  const requestsQuery = useDataRequests('all')
  const mutations = useLegalMutations()

  const [entity, setEntity] = useState<LegalEntity>({})
  useEffect(() => {
    if (entityQuery.data) setEntity(entityQuery.data)
  }, [entityQuery.data])

  const [answering, setAnswering] = useState<string | null>(null)
  const [response, setResponse] = useState('')

  const now = Date.now()
  const requests = useMemo(
    () =>
      (requestsQuery.data ?? []).map((row) => {
        const open = row.status === 'OPEN' || row.status === 'IN_PROGRESS'
        const overdue = open && Date.parse(row.due_at) < now
        return {
          id: row.id,
          email: row.email,
          typeLabel: DATA_REQUEST_TYPES[row.type].label,
          details: row.details,
          statusLabel: DATA_REQUEST_STATUS[row.status].label,
          statusColor: DATA_REQUEST_STATUS[row.status].color,
          created: formatDate(row.created_at),
          due: formatDate(row.due_at),
          overdue,
          open,
          response: row.response,
        }
      }),
    [requestsQuery.data, now],
  )

  const missing = missingEntityFields(entityQuery.data)

  return {
    loading: entityQuery.isLoading,
    missing,
    ready: !entityQuery.isLoading && missing.length === 0,
    fields: LEGAL_ENTITY_FIELDS.map((field) => ({
      ...field,
      value: String(entity[field.key] ?? ''),
    })),
    setField: (key: keyof LegalEntity, value: string) =>
      setEntity((current) => ({ ...current, [key]: value })),
    vatResponsible: entity.vatResponsible ?? null,
    setVatResponsible: (value: boolean) =>
      setEntity((current) => ({ ...current, vatResponsible: value })),
    saving: mutations.updateEntity.isPending,
    save: () => {
      const trimmed = Object.fromEntries(
        Object.entries(entity).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() : value,
        ]),
      ) as LegalEntity
      mutations.updateEntity.mutate(trimmed)
    },

    requests,
    requestsLoading: requestsQuery.isLoading,
    openCount: requests.filter((item) => item.open).length,
    overdueCount: requests.filter((item) => item.overdue).length,
    answering,
    startAnswer: (id: string) => {
      setAnswering(id)
      setResponse('')
    },
    cancelAnswer: () => setAnswering(null),
    response,
    setResponse,
    resolving: mutations.resolveRequest.isPending,
    resolve: (id: string, status: DataRequestStatus) =>
      mutations.resolveRequest.mutate(
        { id, status, response },
        { onSuccess: () => setAnswering(null) },
      ),
  }
}

export type ComplianceViewModel = ReturnType<typeof useComplianceViewModel>
