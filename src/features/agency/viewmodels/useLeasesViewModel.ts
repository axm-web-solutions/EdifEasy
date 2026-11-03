import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllMembers } from '@/hooks/useMembers'
import { useAgencyLeases, useAgencyMutations, useAgencyProperties } from '@/hooks/useAgency'
import { getErrorMessage } from '@/lib/errors'
import { leaseSchema, type LeaseFormValues } from '@/schemas/agency'
import type { PropertyLeaseRow } from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'
import { locationLabel } from '../agency.logic'

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
      rows.map((row) => ({
        id: row.id,
        active: row.status === 'ACTIVE',
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
      })),
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
      deposit: row.deposit === null ? null : Number(row.deposit),
      notes: row.notes ?? '',
    })
    setEditing(row)
    mutations.saveLease.reset()
    setFormOpen(true)
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
          deposit: values.deposit,
          notes: text(values.notes),
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
    submit,
    submitting: mutations.saveLease.isPending,
    submitError: mutations.saveLease.error ? getErrorMessage(mutations.saveLease.error) : null,
  }
}

export type LeasesViewModel = ReturnType<typeof useLeasesViewModel>
