import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyLeases, useLeaseCharges } from '@/hooks/useAgency'
import { useAgencyManagementMutations } from '@/hooks/useAgencyManagement'
import { getErrorMessage } from '@/lib/errors'
import { extraChargeSchema, type ExtraChargeFormValues } from '@/schemas/agency'
import { formatCurrency } from '@/utils/format'
import { agingBuckets, daysLate, lateInterest } from '../management.logic'

const inDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function sixMonthsAgo() {
  const date = new Date()
  date.setMonth(date.getMonth() - 6, 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Cobros que no son el canon ni la administracion: servicios publicos,
 * intereses de mora (con el calculo sugerido) y otros. Tambien la cartera
 * vencida por edades.
 */
export function useExtraChargeViewModel() {
  const { currentCondominiumId } = useAuth()
  const [from] = useState(sixMonthsAgo)
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const chargesQuery = useLeaseCharges(currentCondominiumId, from)
  const mutations = useAgencyManagementMutations()
  const [open, setOpen] = useState(false)

  const leases = useMemo(
    () => (leasesQuery.data ?? []).filter((lease) => lease.status === 'ACTIVE'),
    [leasesQuery.data],
  )
  const charges = useMemo(() => chargesQuery.data ?? [], [chargesQuery.data])

  const form = useForm<ExtraChargeFormValues>({
    resolver: zodResolver(extraChargeSchema),
    defaultValues: { lease_id: '', concept: 'UTILITIES', amount: 0, description: '', due_date: inDays(10) },
  })
  const [leaseId, concept] = useWatch({ control: form.control, name: ['lease_id', 'concept'] })

  // Mora sugerida: tasa pactada sobre el canon vencido, por dias de atraso.
  const lease = leases.find((item) => item.id === leaseId)
  const overdueRent = charges.filter(
    (row) =>
      row.lease_id === leaseId &&
      row.concept === 'RENT' &&
      row.status === 'PENDING' &&
      daysLate(row.due_date) > 0,
  )
  const rate = Number(lease?.late_interest_pct ?? 0)
  const suggested = overdueRent.reduce(
    (sum, row) => sum + lateInterest(Number(row.amount), rate, daysLate(row.due_date)),
    0,
  )

  const aging = agingBuckets(
    charges.map((row) => ({
      amount: Number(row.amount),
      dueDate: row.due_date,
      isPending: row.status === 'PENDING',
    })),
  )

  return {
    aging,
    hasOverdue: aging.some((bucket) => bucket.count > 0),

    open,
    openForm: () => {
      form.reset({
        lease_id: '',
        concept: 'UTILITIES',
        amount: 0,
        description: '',
        due_date: inDays(10),
      })
      mutations.createCharge.reset()
      setOpen(true)
    },
    closeForm: () => setOpen(false),
    control: form.control,
    leaseOptions: leases.map((item) => ({
      value: item.id,
      label: `${item.property?.title ?? 'Propiedad'} · ${item.tenant_name}`,
    })),
    conceptOptions: [
      { value: 'UTILITIES', label: 'Servicios publicos' },
      { value: 'LATE_FEE', label: 'Intereses de mora' },
      { value: 'OTHER', label: 'Otro cobro' },
    ],
    lateFee:
      concept === 'LATE_FEE' && lease
        ? rate > 0
          ? {
              text: overdueRent.length
                ? `Sugerido: ${formatCurrency(suggested)} (${rate} % mensual sobre ${overdueRent.length} canon vencido)`
                : 'Este contrato no tiene canon vencido.',
              amount: suggested,
            }
          : { text: 'Este contrato no tiene tasa de mora pactada.', amount: 0 }
        : null,
    useSuggested: () => {
      form.setValue('amount', suggested, { shouldValidate: true })
      if (!form.getValues('description')) form.setValue('description', 'Intereses de mora')
    },
    submit: form.handleSubmit((values) =>
      mutations.createCharge.mutate(
        {
          leaseId: values.lease_id,
          concept: values.concept,
          amount: values.amount,
          description: values.description,
          dueDate: values.due_date,
        },
        { onSuccess: () => setOpen(false) },
      ),
    ),
    submitting: mutations.createCharge.isPending,
    submitError: mutations.createCharge.error ? getErrorMessage(mutations.createCharge.error) : null,
  }
}

export type ExtraChargeViewModel = ReturnType<typeof useExtraChargeViewModel>
