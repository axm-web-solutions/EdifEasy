import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyLeases, useAgencyProperties, useLeaseCharges } from '@/hooks/useAgency'
import { formatCurrency } from '@/utils/format'
import { toChargeView, toPropertyView } from '../agency.logic'

function sixMonthsAgo() {
  const date = new Date()
  date.setMonth(date.getMonth() - 6, 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Propietario (dueno): sus propiedades, si estan arrendadas y lo que pagan
 * sus arrendatarios. RLS solo devuelve lo suyo.
 */
export function useMyPropertiesViewModel() {
  const { currentCondominiumId, user } = useAuth()
  const [from] = useState(sixMonthsAgo)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const chargesQuery = useLeaseCharges(currentCondominiumId, from)

  const properties = useMemo(() => {
    const leases = leasesQuery.data ?? []
    const charges = chargesQuery.data ?? []
    return (propertiesQuery.data ?? [])
      .filter((row) => row.owner_profile_id === user?.id)
      .map((row) => {
        const lease = leases.find((item) => item.property_id === row.id && item.status === 'ACTIVE')
        const own = charges
          .filter((charge) => charge.property_id === row.id)
          .map((charge) => toChargeView(charge))
        const collected = own
          .filter((charge) => charge.statusLabel === 'Pagado')
          .reduce((sum, c) => sum + c.amount, 0)
        return {
          ...toPropertyView(row),
          tenant: lease ? lease.tenant_name : null,
          rent: lease ? formatCurrency(Number(lease.monthly_rent)) : null,
          collected: formatCurrency(collected),
          pending: own.filter((charge) => charge.isPending).length,
          overdue: own.filter((charge) => charge.isOverdue).length,
          charges: own.slice(0, 6),
        }
      })
  }, [propertiesQuery.data, leasesQuery.data, chargesQuery.data, user?.id])

  return {
    loading: propertiesQuery.isLoading || leasesQuery.isLoading,
    properties,
  }
}
