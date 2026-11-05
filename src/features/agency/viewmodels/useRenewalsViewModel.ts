import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyLeases } from '@/hooks/useAgency'
import { useAgencyManagementMutations, useRentAdjustments } from '@/hooks/useAgencyManagement'
import { getErrorMessage } from '@/lib/errors'
import {
  noticeSchema,
  rentIncreaseSchema,
  type NoticeFormValues,
  type RentIncreaseFormValues,
} from '@/schemas/agency'
import { formatCurrency, formatDate } from '@/utils/format'
import { renewalInfo, rentIncreasePreview } from '../management.logic'

const today = () => new Date().toISOString().slice(0, 10)

export type RenewalFilter = 'all' | 'expiring' | 'notice' | 'increase' | 'policy'

/**
 * Vencimientos: contratos que terminan pronto, preavisos por dar (3 meses en
 * vivienda, 6 en comercial), incrementos anuales pendientes y polizas por
 * vencer. Desde aqui se registra el preaviso y se aplica el incremento.
 */
export function useRenewalsViewModel() {
  const { currentCondominiumId } = useAuth()
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const adjustmentsQuery = useRentAdjustments(currentCondominiumId)
  const mutations = useAgencyManagementMutations()
  const [filter, setFilter] = useState<RenewalFilter>('all')

  const active = useMemo(
    () => (leasesQuery.data ?? []).filter((lease) => lease.status === 'ACTIVE'),
    [leasesQuery.data],
  )
  const items = useMemo(
    () =>
      active
        .map((lease) => ({ lease, info: renewalInfo(lease) }))
        .sort((a, b) => a.info.daysLeft - b.info.daysLeft),
    [active],
  )
  const flagged = items.filter(
    ({ info }) => info.bucket || info.noticeUrgent || info.increaseDue || info.policyExpiring,
  )
  const count = (test: (info: (typeof items)[number]['info']) => boolean) =>
    items.filter((item) => test(item.info)).length

  const visible = flagged.filter(({ info }) =>
    filter === 'expiring'
      ? info.bucket !== null
      : filter === 'notice'
        ? info.noticeUrgent
        : filter === 'increase'
          ? info.increaseDue
          : filter === 'policy'
            ? info.policyExpiring
            : true,
  )

  // ---------------------------------------------------------- incremento
  const [increaseId, setIncreaseId] = useState<string | null>(null)
  const increaseLease = active.find((lease) => lease.id === increaseId) ?? null
  const increaseForm = useForm<RentIncreaseFormValues>({
    resolver: zodResolver(rentIncreaseSchema),
    defaultValues: { index_pct: 0, effective_date: today() },
  })
  const indexPct = useWatch({ control: increaseForm.control, name: 'index_pct' })
  const preview =
    increaseLease && indexPct >= 0
      ? rentIncreasePreview({
          rent: Number(increaseLease.monthly_rent),
          indexPct: Number(indexPct) || 0,
          rule: increaseLease.increase_rule,
          points: Number(increaseLease.increase_points),
          use: increaseLease.lease_use,
        })
      : null

  // ------------------------------------------------------------ preaviso
  const [noticeId, setNoticeId] = useState<string | null>(null)
  const noticeForm = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: { notice_given_at: today(), notice_by: 'ARRENDADOR' },
  })

  return {
    status: leasesQuery.isLoading ? 'loading' : leasesQuery.isError ? 'error' : 'ready',
    retry: () => void leasesQuery.refetch(),
    stats: [
      { key: 'expiring', label: 'Vencen en 90 dias', value: count((info) => info.bucket !== null) },
      { key: 'notice', label: 'Preaviso por dar', value: count((info) => info.noticeUrgent) },
      { key: 'increase', label: 'Incremento pendiente', value: count((info) => info.increaseDue) },
      { key: 'policy', label: 'Polizas por vencer', value: count((info) => info.policyExpiring) },
    ] as { key: RenewalFilter; label: string; value: number }[],
    filter,
    setFilter: (value: RenewalFilter) => setFilter((current) => (current === value ? 'all' : value)),
    totalActive: active.length,
    items: visible.map(({ lease, info }) => ({
      id: lease.id,
      property: lease.property?.title ?? 'Propiedad',
      tenant: lease.tenant_name,
      use: lease.lease_use === 'COMERCIAL' ? 'Comercial' : 'Vivienda',
      rent: formatCurrency(Number(lease.monthly_rent)),
      endLabel: `Vence el ${formatDate(info.endDate)} (${info.daysLeft} dias)${lease.auto_renew ? ' · se prorroga sola' : ''}`,
      urgency: info.bucket === 'D30' ? 'red' : info.bucket === 'D60' ? 'orange' : info.bucket ? 'gold' : null,
      bucketLabel:
        info.bucket === 'D30' ? '30 dias' : info.bucket === 'D60' ? '60 dias' : info.bucket ? '90 dias' : null,
      notice: lease.notice_given_at
        ? `Preaviso dado el ${formatDate(lease.notice_given_at)} por el ${lease.notice_by === 'ARRENDATARIO' ? 'arrendatario' : 'arrendador'}`
        : `Preaviso de ${lease.notice_months} meses: hasta el ${formatDate(info.noticeDeadline)}`,
      noticeUrgent: info.noticeUrgent,
      hasNotice: Boolean(lease.notice_given_at),
      increase: info.increaseDue
        ? `Incremento pendiente desde el ${formatDate(info.nextIncrease)}`
        : `Proximo incremento: ${formatDate(info.nextIncrease)}`,
      increaseDue: info.increaseDue,
      policy: lease.policy_expires_at
        ? `Poliza ${lease.insurer ?? ''} vence el ${formatDate(lease.policy_expires_at)}`
        : null,
      policyExpiring: info.policyExpiring,
      contractHref: `/agency/leases/${lease.id}/contract`,
    })),
    history: (adjustmentsQuery.data ?? []).slice(0, 10).map((row) => {
      const lease = (leasesQuery.data ?? []).find((item) => item.id === row.lease_id)
      return {
        id: row.id,
        label: `${lease?.property?.title ?? 'Contrato'}: ${formatCurrency(Number(row.previous_rent))} → ${formatCurrency(Number(row.new_rent))}`,
        detail: `Desde ${formatDate(row.effective_date)} · indice ${Number(row.index_value)} %`,
      }
    }),

    // incremento
    increaseOpen: Boolean(increaseLease),
    increaseTitle: increaseLease
      ? `Incremento: ${increaseLease.property?.title ?? ''} (${increaseLease.tenant_name})`
      : '',
    increaseRule:
      increaseLease?.lease_use === 'VIVIENDA'
        ? 'Vivienda: hasta el 100 % del IPC del ano anterior (Ley 820, art. 20). Consulta el IPC del DANE.'
        : increaseLease?.increase_rule === 'IPC_PLUS'
          ? `Comercial: IPC + ${Number(increaseLease.increase_points)} puntos pactados.`
          : increaseLease?.increase_rule === 'FIXED'
            ? 'Comercial: porcentaje fijo pactado (escribelo como indice).'
            : 'Comercial: IPC del ano anterior.',
    openIncrease: (id: string) => {
      const lease = active.find((item) => item.id === id)
      if (!lease) return
      increaseForm.reset({
        index_pct: lease.increase_rule === 'FIXED' ? Number(lease.increase_points) : 0,
        effective_date: renewalInfo(lease).nextIncrease,
      })
      mutations.applyRentIncrease.reset()
      setIncreaseId(id)
    },
    closeIncrease: () => setIncreaseId(null),
    increaseControl: increaseForm.control,
    preview: preview
      ? {
          current: formatCurrency(Number(increaseLease?.monthly_rent ?? 0)),
          next: formatCurrency(preview.newRent),
          pct: `${preview.pct} %`,
          capped: preview.capped,
        }
      : null,
    submitIncrease: increaseForm.handleSubmit((values) => {
      if (!increaseId) return
      mutations.applyRentIncrease.mutate(
        { leaseId: increaseId, indexPct: values.index_pct, effectiveDate: values.effective_date },
        { onSuccess: () => setIncreaseId(null) },
      )
    }),
    applying: mutations.applyRentIncrease.isPending,
    increaseError: mutations.applyRentIncrease.error
      ? getErrorMessage(mutations.applyRentIncrease.error)
      : null,

    // preaviso
    noticeOpen: Boolean(noticeId),
    openNotice: (id: string) => {
      noticeForm.reset({ notice_given_at: today(), notice_by: 'ARRENDADOR' })
      setNoticeId(id)
    },
    closeNotice: () => setNoticeId(null),
    noticeControl: noticeForm.control,
    noticeByOptions: [
      { value: 'ARRENDADOR', label: 'La inmobiliaria / propietario (no renovar)' },
      { value: 'ARRENDATARIO', label: 'El arrendatario (se va)' },
    ],
    submitNotice: noticeForm.handleSubmit((values) => {
      if (!noticeId) return
      mutations.registerNotice.mutate(
        { leaseId: noticeId, noticeGivenAt: values.notice_given_at, noticeBy: values.notice_by },
        { onSuccess: () => setNoticeId(null) },
      )
    }),
    savingNotice: mutations.registerNotice.isPending,
    clearNotice: (id: string) => mutations.clearNotice.mutate(id),
  }
}

export type RenewalsViewModel = ReturnType<typeof useRenewalsViewModel>
