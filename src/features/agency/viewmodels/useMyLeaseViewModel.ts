import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyLeases,
  useAgencyMutations,
  useAgencyProperties,
  useAgencyRealtime,
  useLeaseCharges,
} from '@/hooks/useAgency'
import { getErrorMessage } from '@/lib/errors'
import { formatCurrency, formatDate } from '@/utils/format'
import { locationLabel, specs, toChargeView } from '../agency.logic'

function yearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1, date.getMonth(), 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Arrendatario: su contrato, lo que debe y el pago en linea (canon y
 * administracion en un solo pago, directo a la inmobiliaria).
 * RLS solo devuelve su contrato, su propiedad y sus cobros.
 */
export function useMyLeaseViewModel() {
  const { currentCondominiumId, user } = useAuth()
  const [from] = useState(yearAgo)
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const chargesQuery = useLeaseCharges(currentCondominiumId, from)
  const mutations = useAgencyMutations()
  useAgencyRealtime(currentCondominiumId)

  const lease = (leasesQuery.data ?? []).find(
    (item) => item.status === 'ACTIVE' && item.tenant_profile_id === user?.id,
  )
  const property =
    (propertiesQuery.data ?? []).find((item) => item.id === lease?.property_id) ?? null
  const charges = useMemo(
    () =>
      (chargesQuery.data ?? [])
        .filter((row) => row.lease_id === lease?.id)
        .map((row) => toChargeView(row)),
    [chargesQuery.data, lease?.id],
  )
  const pending = charges.filter((charge) => charge.isPending)
  const [selected, setSelected] = useState<string[] | null>(null)
  const chosen = selected ?? pending.map((charge) => charge.id)
  const total = pending
    .filter((charge) => chosen.includes(charge.id))
    .reduce((sum, charge) => sum + charge.amount, 0)

  return {
    loading: leasesQuery.isLoading || chargesQuery.isLoading,
    hasLease: Boolean(lease),
    property: property
      ? {
          title: property.title,
          cover: property.images[0] ?? null,
          address: [property.address, locationLabel(property)].filter(Boolean).join(' · '),
          specs: specs(property),
        }
      : lease
        ? { title: lease.property?.title ?? 'Tu propiedad', cover: null, address: '', specs: [] }
        : null,
    lease: lease
      ? {
          rent: formatCurrency(Number(lease.monthly_rent)),
          adminFee: Number(lease.admin_fee) > 0 ? formatCurrency(Number(lease.admin_fee)) : null,
          dueDay: lease.due_day,
          period: `Desde ${formatDate(lease.start_date)}${lease.end_date ? ` hasta ${formatDate(lease.end_date)}` : ''}`,
        }
      : null,
    pending,
    history: charges.filter((charge) => !charge.isPending).slice(0, 24),
    chosen,
    toggle: (id: string) =>
      setSelected((current) => {
        const base = current ?? pending.map((charge) => charge.id)
        return base.includes(id) ? base.filter((item) => item !== id) : [...base, id]
      }),
    totalLabel: formatCurrency(total),
    pay: () => {
      if (chosen.length)
        mutations.payCharges.mutate(
          chosen.filter((id) => pending.some((charge) => charge.id === id)),
        )
    },
    paying: mutations.payCharges.isPending,
    payError: mutations.payCharges.error ? getErrorMessage(mutations.payCharges.error) : null,
  }
}

export type MyLeaseViewModel = ReturnType<typeof useMyLeaseViewModel>
