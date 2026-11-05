import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllMembers } from '@/hooks/useMembers'
import { useAgencyLeases, useAgencyMutations, useAgencyProperties } from '@/hooks/useAgency'
import { getErrorMessage } from '@/lib/errors'
import { leaseSchema, type LeaseFormValues } from '@/schemas/agency'
import type { PropertyLeaseRow } from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'
import { locationLabel } from '../agency.logic'
import {
  CONTRACT_STATUS,
  INCREASE_RULES,
  LEASE_USES,
  renewalInfo,
} from '../management.logic'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY: LeaseFormValues = {
  property_id: '',
  tenant_profile_id: null,
  tenant_name: '',
  tenant_document: '',
  tenant_email: '',
  tenant_phone: '',
  start_date: today(),
  end_date: null,
  monthly_rent: 0,
  admin_fee: 0,
  due_day: 5,
  deposit: null,
  notes: '',
  lease_use: 'VIVIENDA',
  term_months: 12,
  auto_renew: true,
  notice_months: 3,
  increase_rule: 'IPC',
  increase_points: 0,
  late_interest_pct: null,
  insurer: '',
  policy_number: '',
  policy_expires_at: null,
}

/** Contratos de arriendo: quien vive, cuanto paga y cuando vence cada mes. */
export function useLeasesViewModel() {
  const { currentCondominiumId } = useAuth()
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const membersQuery = useAllMembers(currentCondominiumId)
  const mutations = useAgencyMutations()

  const rows = useMemo(() => leasesQuery.data ?? [], [leasesQuery.data])
  const tenants = useMemo(
    () =>
      (membersQuery.data ?? []).filter(
        (member) => member.role?.code === 'TENANT' && member.profile,
      ),
    [membersQuery.data],
  )

  const views = useMemo(
    () =>
      rows.map((row) => {
        const renewal = row.status === 'ACTIVE' ? renewalInfo(row) : null
        const contract = CONTRACT_STATUS[row.contract_status ?? 'NONE']
        return {
        id: row.id,
        active: row.status === 'ACTIVE',
        useLabel: row.lease_use === 'COMERCIAL' ? 'Comercial' : 'Vivienda',
        contractLabel: contract.label,
        contractColor: contract.color,
        contractHref: `/agency/leases/${row.id}/contract`,
        guarantee: row.insurer
          ? `Poliza ${row.insurer}${row.policy_number ? ` No. ${row.policy_number}` : ''}`
          : null,
        renewalLabel: renewal
          ? `Periodo actual hasta ${formatDate(renewal.endDate)}${row.auto_renew ? ' (prorroga automatica)' : ''}`
          : null,
        property: row.property?.title ?? 'Propiedad eliminada',
        location: row.property ? locationLabel(row.property) : '',
        tenant: row.tenant_name,
        hasAccount: Boolean(row.tenant_profile_id),
        contact: [row.tenant_phone, row.tenant_email].filter(Boolean).join(' · '),
        rent: formatCurrency(Number(row.monthly_rent)),
        adminFee: Number(row.admin_fee) > 0 ? formatCurrency(Number(row.admin_fee)) : null,
        period: `${formatDate(row.start_date)} → ${row.end_date ? formatDate(row.end_date) : 'indefinido'}`,
        dueDay: `Paga los ${row.due_day} de cada mes`,
        statusLabel:
          row.status === 'ACTIVE' ? 'Vigente' : row.status === 'ENDED' ? 'Terminado' : 'Cancelado',
        statusColor: row.status === 'ACTIVE' ? 'green' : 'default',
        }
      }),
    [rows],
  )

  // ------------------------------------------------------------ formulario
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PropertyLeaseRow | null>(null)
  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseSchema),
    defaultValues: EMPTY,
  })

  const availableProperties = (propertiesQuery.data ?? []).filter(
    (property) =>
      property.operation !== 'SALE' &&
      (property.status !== 'RENTED' || property.id === editing?.property_id),
  )

  const openNew = () => {
    form.reset({ ...EMPTY, start_date: today() })
    setEditing(null)
    mutations.saveLease.reset()
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const row = rows.find((item) => item.id === id)
    if (!row) return
    form.reset({
      property_id: row.property_id,
      tenant_profile_id: row.tenant_profile_id,
      tenant_name: row.tenant_name,
      tenant_document: row.tenant_document ?? '',
      tenant_email: row.tenant_email ?? '',
      tenant_phone: row.tenant_phone ?? '',
      start_date: row.start_date,
      end_date: row.end_date,
      monthly_rent: Number(row.monthly_rent),
      admin_fee: Number(row.admin_fee),
      due_day: row.due_day,
      // En vivienda el formulario no maneja deposito: el de contratos viejos se conserva.
      deposit:
        row.deposit === null || row.lease_use !== 'COMERCIAL' ? null : Number(row.deposit),
      notes: row.notes ?? '',
      lease_use: row.lease_use ?? 'VIVIENDA',
      term_months: row.term_months ?? 12,
      auto_renew: row.auto_renew ?? true,
      notice_months: row.notice_months ?? 3,
      increase_rule: row.increase_rule ?? 'IPC',
      increase_points: Number(row.increase_points ?? 0),
      late_interest_pct: row.late_interest_pct === null ? null : Number(row.late_interest_pct),
      insurer: row.insurer ?? '',
      policy_number: row.policy_number ?? '',
      policy_expires_at: row.policy_expires_at,
    })
    setEditing(row)
    mutations.saveLease.reset()
    setFormOpen(true)
  }

  // Vivienda (Ley 820): sin deposito, incremento por IPC y preaviso de 3 meses.
  const leaseUse = useWatch({ control: form.control, name: 'lease_use' })
  const increaseRule = useWatch({ control: form.control, name: 'increase_rule' })
  const isHousing = leaseUse !== 'COMERCIAL'
  const onUseChange = (value: string | string[] | null) => {
    if (value === 'VIVIENDA') {
      form.setValue('deposit', null)
      form.setValue('increase_rule', 'IPC')
      if (form.getValues('notice_months') === 6) form.setValue('notice_months', 3)
    } else if (form.getValues('notice_months') === 3) {
      form.setValue('notice_months', 6)
    }
  }

  /** Al elegir la propiedad se proponen su canon y administracion. */
  const onPropertyChange = (value: string | string[] | null) => {
    const property = propertiesQuery.data?.find((item) => item.id === value)
    if (!property || editing) return
    if (property.rent_price !== null) form.setValue('monthly_rent', Number(property.rent_price))
    form.setValue('admin_fee', Number(property.admin_fee))
  }

  /** Al elegir un arrendatario con cuenta se llenan sus datos. */
  const onTenantChange = (value: string | string[] | null) => {
    const member = tenants.find((item) => item.user_id === value)
    if (!member?.profile) return
    form.setValue('tenant_name', member.profile.full_name ?? '')
    form.setValue('tenant_email', member.profile.email ?? '')
    form.setValue('tenant_phone', member.profile.phone ?? '')
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const text = (value: string) => value.trim() || null
    mutations.saveLease.mutate(
      {
        id: editing?.id ?? null,
        values: {
          condominium_id: currentCondominiumId,
          property_id: values.property_id,
          tenant_profile_id: values.tenant_profile_id || null,
          tenant_name: values.tenant_name,
          tenant_document: text(values.tenant_document),
          tenant_email: text(values.tenant_email),
          tenant_phone: text(values.tenant_phone),
          start_date: values.start_date,
          end_date: values.end_date || null,
          monthly_rent: values.monthly_rent,
          admin_fee: values.admin_fee,
          due_day: values.due_day,
          ...(values.lease_use === 'COMERCIAL'
            ? { deposit: values.deposit }
            : editing
              ? {}
              : { deposit: null }),
          notes: text(values.notes),
          lease_use: values.lease_use,
          term_months: values.term_months,
          auto_renew: values.auto_renew,
          notice_months: values.notice_months,
          increase_rule: values.lease_use === 'VIVIENDA' ? 'IPC' : values.increase_rule,
          increase_points: values.increase_rule === 'IPC' ? 0 : values.increase_points,
          late_interest_pct: values.late_interest_pct || null,
          insurer: text(values.insurer),
          policy_number: text(values.policy_number),
          policy_expires_at: values.policy_expires_at || null,
        },
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  return {
    status: leasesQuery.isLoading
      ? 'loading'
      : leasesQuery.isError
        ? 'error'
        : rows.length
          ? 'ready'
          : 'empty',
    retry: () => void leasesQuery.refetch(),
    active: views.filter((view) => view.active),
    past: views.filter((view) => !view.active),
    endLease: (id: string) => mutations.endLease.mutate({ id, endDate: today() }),

    formOpen,
    isEditing: Boolean(editing),
    openNew,
    openEdit,
    closeForm: () => setFormOpen(false),
    control: form.control,
    propertyOptions: availableProperties.map((property) => ({
      value: property.id,
      label: `${property.title}${property.code ? ` (${property.code})` : ''}`,
    })),
    tenantOptions: tenants.map((member) => ({
      value: member.user_id,
      label: member.profile?.full_name ?? member.profile?.email ?? 'Arrendatario',
    })),
    onPropertyChange,
    onTenantChange,
    isHousing,
    onUseChange,
    showIncreasePoints: !isHousing && increaseRule !== 'IPC',
    increasePointsLabel: increaseRule === 'FIXED' ? 'Porcentaje pactado (%)' : 'Puntos sobre el IPC',
    useOptions: LEASE_USES.map((item) => ({ value: item.value, label: item.label })),
    useHelp: LEASE_USES.find((item) => item.value === (leaseUse ?? 'VIVIENDA'))?.help ?? '',
    increaseOptions: isHousing
      ? INCREASE_RULES.filter((item) => item.value === 'IPC')
      : INCREASE_RULES,
    submit,
    submitting: mutations.saveLease.isPending,
    submitError: mutations.saveLease.error ? getErrorMessage(mutations.saveLease.error) : null,
  }
}

export type LeasesViewModel = ReturnType<typeof useLeasesViewModel>
