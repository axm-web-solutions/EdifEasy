import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyLeads,
  useAgencyProperties,
  useAgencyRealtime,
  useLeaseCharges,
  usePaymentAccount,
  useStoreSettings,
} from '@/hooks/useAgency'
import { agencyStats, chargesSummary, toChargeView } from '../agency.logic'

function threeMonthsAgo() {
  const date = new Date()
  date.setMonth(date.getMonth() - 3, 1)
  return date.toISOString().slice(0, 10)
}

/** Panel de la inmobiliaria: ocupacion, cartera, interesados y pendientes. */
export function useAgencyDashboardViewModel() {
  const { currentCondominiumId, currentMembership } = useAuth()
  const [from] = useState(threeMonthsAgo)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const chargesQuery = useLeaseCharges(currentCondominiumId, from)
  const leadsQuery = useAgencyLeads(currentCondominiumId)
  const accountQuery = usePaymentAccount(currentCondominiumId)
  const storeQuery = useStoreSettings(currentCondominiumId)
  useAgencyRealtime(currentCondominiumId)

  const stats = useMemo(() => agencyStats(propertiesQuery.data ?? []), [propertiesQuery.data])
  const charges = useMemo(
    () => chargesSummary((chargesQuery.data ?? []).map((row) => toChargeView(row))),
    [chargesQuery.data],
  )
  const newLeads = (leadsQuery.data ?? []).filter((lead) => lead.status === 'NEW').length

  // Pasos para dejar la inmobiliaria lista.
  const setup = [
    {
      key: 'store',
      label: 'Configura el enlace de tu tienda',
      done: Boolean(storeQuery.data?.slug),
      to: '/agency/store',
    },
    {
      key: 'property',
      label: 'Publica tu primera propiedad',
      done: stats.published > 0,
      to: '/agency/properties',
    },
    {
      key: 'wompi',
      label: 'Conecta tu cuenta Wompi para cobrar en linea',
      done: Boolean(accountQuery.data),
      to: '/agency/store',
    },
  ]

  return {
    loading: propertiesQuery.isLoading || chargesQuery.isLoading,
    name: currentMembership?.condominium_name ?? 'Inmobiliaria',
    stats,
    charges,
    newLeads,
    setup: setup.filter((step) => !step.done),
    storeUrl: storeQuery.data?.slug ? `${window.location.origin}/i/${storeQuery.data.slug}` : null,
  }
}
