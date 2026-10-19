import { useState } from 'react'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { useDataRequests, useLegalMutations, useMyAcceptances } from '@/hooks/useLegal'
import type { DataRequestType } from '@/types/database'
import { downloadBlob } from '@/utils/export'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/utils/format'
import { DATA_REQUEST_STATUS, DATA_REQUEST_TYPES } from '../legal.constants'

/** "Privacidad y datos" en Configuracion: derechos del titular (Ley 1581, art. 8). */
export function usePrivacyViewModel() {
  const { user } = useAuth()
  const acceptancesQuery = useMyAcceptances(user?.id ?? null)
  const requestsQuery = useDataRequests('mine', Boolean(user))
  const mutations = useLegalMutations()

  const [type, setType] = useState<DataRequestType>('ACCESS')
  const [details, setDetails] = useState('')

  return {
    acceptances: (acceptancesQuery.data ?? []).map((row) => ({
      id: row.id,
      label:
        row.document === 'TERMS'
          ? 'Terminos y condiciones'
          : row.document === 'PRIVACY'
            ? 'Tratamiento de datos personales'
            : 'Reglas del marketplace',
      version: row.version,
      date: formatDateTime(row.accepted_at),
    })),
    loadingAcceptances: acceptancesQuery.isLoading,

    exporting: mutations.exportData.isPending,
    exportData: () =>
      mutations.exportData.mutate(undefined, {
        onSuccess: (data) =>
          downloadBlob(
            JSON.stringify(data, null, 2),
            `mis-datos-edifeasy-${dayjs().format('YYYYMMDD')}.json`,
            'application/json',
          ),
      }),

    typeOptions: Object.entries(DATA_REQUEST_TYPES).map(([value, meta]) => ({
      value,
      label: meta.label,
    })),
    type,
    setType,
    typeHint: DATA_REQUEST_TYPES[type].hint,
    details,
    setDetails,
    submitting: mutations.createRequest.isPending,
    submitError: mutations.createRequest.error
      ? getErrorMessage(mutations.createRequest.error)
      : null,
    submit: () =>
      mutations.createRequest.mutate(
        { type, details: details.trim() || null },
        { onSuccess: () => setDetails('') },
      ),

    requests: (requestsQuery.data ?? []).map((row) => ({
      id: row.id,
      typeLabel: DATA_REQUEST_TYPES[row.type].label,
      statusLabel: DATA_REQUEST_STATUS[row.status].label,
      statusColor: DATA_REQUEST_STATUS[row.status].color,
      created: formatDate(row.created_at),
      due: formatDate(row.due_at),
      details: row.details,
      response: row.response,
    })),
  }
}

export type PrivacyViewModel = ReturnType<typeof usePrivacyViewModel>
