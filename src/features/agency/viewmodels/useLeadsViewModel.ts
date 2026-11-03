import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyLeads, useAgencyMutations, useAgencyRealtime } from '@/hooks/useAgency'
import type { AgencyLeadRow } from '@/types/database'
import { formatRelative } from '@/utils/format'
import { telHref, whatsappHref } from '@/utils/phone'

const STATUS: Record<AgencyLeadRow['status'], { label: string; color: string }> = {
  NEW: { label: 'Nuevo', color: 'blue' },
  CONTACTED: { label: 'Contactado', color: 'gold' },
  CLOSED: { label: 'Cerrado', color: 'default' },
}

/** Personas que dejaron sus datos en la tienda publica. */
export function useLeadsViewModel() {
  const { currentCondominiumId } = useAuth()
  const query = useAgencyLeads(currentCondominiumId)
  const mutations = useAgencyMutations()
  useAgencyRealtime(currentCondominiumId)
  const [filter, setFilter] = useState<AgencyLeadRow['status'] | 'ALL'>('NEW')

  const rows = useMemo(() => query.data ?? [], [query.data])
  const leads = useMemo(
    () =>
      rows
        .filter((row) => filter === 'ALL' || row.status === filter)
        .map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          message: row.message,
          property: row.property?.title ?? null,
          when: formatRelative(row.created_at),
          status: row.status,
          statusLabel: STATUS[row.status].label,
          statusColor: STATUS[row.status].color,
          whatsapp: whatsappHref(
            row.phone,
            `Hola ${row.name}, te escribimos de la inmobiliaria${row.property ? ` por "${row.property.title}"` : ''}.`,
          ),
          call: telHref(row.phone),
        })),
    [rows, filter],
  )

  return {
    status: query.isLoading ? 'loading' : query.isError ? 'error' : 'ready',
    retry: () => void query.refetch(),
    leads,
    filter,
    setFilter,
    filterOptions: [
      { value: 'NEW', label: `Nuevos (${rows.filter((row) => row.status === 'NEW').length})` },
      { value: 'CONTACTED', label: 'Contactados' },
      { value: 'CLOSED', label: 'Cerrados' },
      { value: 'ALL', label: 'Todos' },
    ],
    setStatus: (id: string, status: AgencyLeadRow['status']) =>
      mutations.setLeadStatus.mutate({ id, status }),
  }
}

export type LeadsViewModel = ReturnType<typeof useLeadsViewModel>
