import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAllMembers } from '@/hooks/useMembers'
import { useAgencyProperties } from '@/hooks/useAgency'
import { useAgencyManagementMutations, useAgreements } from '@/hooks/useAgencyManagement'
import { getErrorMessage } from '@/lib/errors'
import { agreementSchema, type AgreementFormValues } from '@/schemas/agency'
import type { ManagementAgreementRow } from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'
import { settlementPreview } from '../management.logic'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY: AgreementFormValues = {
  property_id: '',
  owner_profile_id: null,
  owner_name: '',
  owner_document_type: 'CC',
  owner_document: '',
  owner_email: '',
  owner_phone: '',
  commission_pct: 10,
  charges_vat: true,
  vat_pct: 19,
  withholding_pct: 0,
  bank_name: '',
  account_type: 'AHORROS',
  account_number: '',
  account_holder: '',
  start_date: today(),
  notes: '',
}

const mask = (value: string | null) => (value ? `****${value.slice(-4)}` : null)

/**
 * Propietarios: el mandato de administracion de cada propiedad (comision,
 * IVA, retencion y cuenta donde se le gira). Sin mandato no hay liquidacion.
 */
export function useAgreementsViewModel() {
  const { currentCondominiumId } = useAuth()
  const agreementsQuery = useAgreements(currentCondominiumId)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const membersQuery = useAllMembers(currentCondominiumId)
  const mutations = useAgencyManagementMutations()

  const agreements = useMemo(() => agreementsQuery.data ?? [], [agreementsQuery.data])
  const properties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data])
  const owners = useMemo(
    () =>
      (membersQuery.data ?? []).filter((member) => member.role?.code === 'OWNER' && member.profile),
    [membersQuery.data],
  )

  const active = agreements.filter((item) => item.status === 'ACTIVE')
  const covered = new Set(active.map((item) => item.property_id))
  const rentable = properties.filter(
    (property) => property.operation !== 'SALE' && property.status !== 'INACTIVE',
  )
  const missing = rentable.filter((property) => !covered.has(property.id))

  const views = active.map((item) => {
    const property = properties.find((row) => row.id === item.property_id)
    const rent = Number(property?.rent_price ?? 0)
    const preview = rent ? settlementPreview(rent, item) : null
    return {
      id: item.id,
      property: item.property?.title ?? property?.title ?? 'Propiedad',
      owner: item.owner_name,
      hasAccount: Boolean(item.owner_profile_id),
      document: item.owner_document ? `${item.owner_document_type} ${item.owner_document}` : null,
      terms: `Comision ${Number(item.commission_pct)} %${item.charges_vat ? ` + IVA ${Number(item.vat_pct)} %` : ''}${
        Number(item.withholding_pct) ? ` · Retencion ${Number(item.withholding_pct)} %` : ''
      }`,
      bank: item.bank_name
        ? [item.bank_name, item.account_type?.toLowerCase(), mask(item.account_number)]
            .filter(Boolean)
            .join(' ')
        : null,
      since: `Desde ${formatDate(item.start_date)}`,
      preview: preview
        ? `De un canon de ${formatCurrency(rent)} recibe ${formatCurrency(preview.net)} (tu comision ${formatCurrency(preview.commission + preview.vat)})`
        : null,
    }
  })

  // ------------------------------------------------------------ formulario
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ManagementAgreementRow | null>(null)
  const form = useForm<AgreementFormValues>({
    resolver: zodResolver(agreementSchema),
    defaultValues: EMPTY,
  })
  const [commission, chargesVat, vatPct, withholding, propertyId] = useWatch({
    control: form.control,
    name: ['commission_pct', 'charges_vat', 'vat_pct', 'withholding_pct', 'property_id'],
  })

  const openNew = (forProperty?: string) => {
    const property = properties.find((item) => item.id === forProperty)
    form.reset({
      ...EMPTY,
      start_date: today(),
      property_id: forProperty ?? '',
      owner_profile_id: property?.owner_profile_id ?? null,
      owner_name: property?.owner_name ?? '',
      owner_phone: property?.owner_phone ?? '',
    })
    setEditing(null)
    mutations.saveAgreement.reset()
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const row = agreements.find((item) => item.id === id)
    if (!row) return
    form.reset({
      property_id: row.property_id,
      owner_profile_id: row.owner_profile_id,
      owner_name: row.owner_name,
      owner_document_type: row.owner_document_type,
      owner_document: row.owner_document ?? '',
      owner_email: row.owner_email ?? '',
      owner_phone: row.owner_phone ?? '',
      commission_pct: Number(row.commission_pct),
      charges_vat: row.charges_vat,
      vat_pct: Number(row.vat_pct),
      withholding_pct: Number(row.withholding_pct),
      bank_name: row.bank_name ?? '',
      account_type: row.account_type,
      account_number: row.account_number ?? '',
      account_holder: row.account_holder ?? '',
      start_date: row.start_date,
      notes: row.notes ?? '',
    })
    setEditing(row)
    mutations.saveAgreement.reset()
    setFormOpen(true)
  }

  const onOwnerChange = (value: string | string[] | null) => {
    const member = owners.find((item) => item.user_id === value)
    if (!member?.profile) return
    form.setValue('owner_name', member.profile.full_name ?? '')
    form.setValue('owner_email', member.profile.email ?? '')
    form.setValue('owner_phone', member.profile.phone ?? '')
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const text = (value: string) => value.trim() || null
    mutations.saveAgreement.mutate(
      {
        id: editing?.id ?? null,
        values: {
          condominium_id: currentCondominiumId,
          property_id: values.property_id,
          owner_profile_id: values.owner_profile_id || null,
          owner_name: values.owner_name,
          owner_document_type: values.owner_document_type,
          owner_document: text(values.owner_document),
          owner_email: text(values.owner_email),
          owner_phone: text(values.owner_phone),
          commission_pct: values.commission_pct,
          charges_vat: values.charges_vat,
          vat_pct: values.vat_pct,
          withholding_pct: values.withholding_pct,
          bank_name: text(values.bank_name),
          account_type: values.bank_name.trim() ? values.account_type : null,
          account_number: text(values.account_number),
          account_holder: text(values.account_holder),
          start_date: values.start_date,
          notes: text(values.notes),
        },
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  const formRent = Number(properties.find((item) => item.id === propertyId)?.rent_price ?? 0)
  const formPreview = formRent
    ? settlementPreview(formRent, {
        commission_pct: commission ?? 0,
        charges_vat: chargesVat ?? false,
        vat_pct: vatPct ?? 0,
        withholding_pct: withholding ?? 0,
      })
    : null

  return {
    status: agreementsQuery.isLoading
      ? 'loading'
      : agreementsQuery.isError
        ? 'error'
        : views.length || missing.length
          ? 'ready'
          : 'empty',
    retry: () => void agreementsQuery.refetch(),
    agreements: views,
    missing: missing.map((property) => ({
      id: property.id,
      title: property.title,
      owner: property.owner_name,
    })),
    endAgreement: (id: string) => mutations.endAgreement.mutate({ id, endDate: today() }),

    formOpen,
    isEditing: Boolean(editing),
    openNew,
    openEdit,
    closeForm: () => setFormOpen(false),
    control: form.control,
    propertyOptions: rentable
      .filter((property) => !covered.has(property.id) || property.id === editing?.property_id)
      .map((property) => ({
        value: property.id,
        label: `${property.title}${property.code ? ` (${property.code})` : ''}`,
      })),
    ownerOptions: owners.map((member) => ({
      value: member.user_id,
      label: member.profile?.full_name ?? member.profile?.email ?? 'Propietario',
    })),
    onOwnerChange,
    documentTypes: [
      { value: 'CC', label: 'Cedula' },
      { value: 'CE', label: 'Cedula de extranjeria' },
      { value: 'NIT', label: 'NIT' },
      { value: 'PASAPORTE', label: 'Pasaporte' },
    ],
    accountTypes: [
      { value: 'AHORROS', label: 'Ahorros' },
      { value: 'CORRIENTE', label: 'Corriente' },
    ],
    showVat: Boolean(chargesVat),
    formPreview: formPreview
      ? [
          { label: 'Canon', value: formatCurrency(formPreview.gross) },
          { label: 'Comision', value: `- ${formatCurrency(formPreview.commission)}` },
          { label: 'IVA de la comision', value: `- ${formatCurrency(formPreview.vat)}` },
          { label: 'Retencion', value: `- ${formatCurrency(formPreview.withholding)}` },
          { label: 'Neto al propietario', value: formatCurrency(formPreview.net), strong: true },
        ]
      : null,
    submit,
    submitting: mutations.saveAgreement.isPending,
    submitError: mutations.saveAgreement.error
      ? getErrorMessage(mutations.saveAgreement.error)
      : null,
  }
}

export type AgreementsViewModel = ReturnType<typeof useAgreementsViewModel>
