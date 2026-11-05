import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyLeases, useAgencyProperties } from '@/hooks/useAgency'
import {
  useAgencyManagementMutations,
  useAgencyManagementRealtime,
  useAgreements,
  useGuarantors,
  useLeaseSigners,
} from '@/hooks/useAgencyManagement'
import { getErrorMessage } from '@/lib/errors'
import { notify } from '@/lib/notify'
import { guarantorSchema, type GuarantorFormValues } from '@/schemas/agency'
import type { SignerInput } from '@/services/agencyManagementService'
import { formatDateTime } from '@/utils/format'
import { whatsappHref } from '@/utils/phone'
import { typeLabel } from '../agency.logic'
import { CONTRACT_STATUS, SIGNER_ROLES, contractTemplate } from '../management.logic'

/**
 * Contrato y firma de un arriendo: texto (plantilla con los datos del
 * sistema, editable), codeudores, firmantes, envio a firma con enlaces y el
 * contrato firmado con la evidencia de cada firma.
 */
export function useLeaseContractViewModel(leaseId: string) {
  const { currentCondominiumId, currentMembership, profile, user } = useAuth()
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const propertiesQuery = useAgencyProperties(currentCondominiumId)
  const agreementsQuery = useAgreements(currentCondominiumId)
  const guarantorsQuery = useGuarantors(leaseId)
  const signersQuery = useLeaseSigners([leaseId])
  const mutations = useAgencyManagementMutations()
  useAgencyManagementRealtime(currentCondominiumId)

  const lease = (leasesQuery.data ?? []).find((item) => item.id === leaseId) ?? null
  const property = (propertiesQuery.data ?? []).find((item) => item.id === lease?.property_id)
  const agreement = (agreementsQuery.data ?? []).find(
    (item) => item.property_id === lease?.property_id && item.status === 'ACTIVE',
  )
  const guarantors = useMemo(() => guarantorsQuery.data ?? [], [guarantorsQuery.data])
  const signers = signersQuery.data ?? []
  const agencyName = currentMembership?.condominium_name ?? 'La inmobiliaria'
  const status = lease?.contract_status ?? 'NONE'
  const editable = status === 'NONE'

  // ---------------------------------------------------------------- texto
  const template = useMemo(() => {
    if (!lease) return ''
    return contractTemplate({
      city: property?.city ?? '',
      agency: { name: agencyName },
      ownerName: agreement?.owner_name ?? property?.owner_name ?? null,
      tenant: {
        name: lease.tenant_name,
        document: lease.tenant_document,
        email: lease.tenant_email,
        phone: lease.tenant_phone,
      },
      guarantors: guarantors.map((item) => ({ name: item.name, document: item.document })),
      property: {
        title: property?.title ?? lease.property?.title ?? 'Inmueble',
        address: property?.address ?? lease.property?.address ?? null,
        city: property?.city ?? lease.property?.city ?? null,
        type: property ? typeLabel(property.property_type) : null,
      },
      lease,
    })
  }, [lease, property, agreement, guarantors, agencyName])

  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    // Al abrir: el texto guardado (si ya se envio) o la plantilla.
    if (text === null && lease) setText(lease.contract_text ?? null)
  }, [lease, text])
  const currentText = text ?? template

  // ------------------------------------------------------------ firmantes
  const [includeOwner, setIncludeOwner] = useState(false)
  const ownerName = agreement?.owner_name ?? property?.owner_name ?? null
  const proposedSigners: SignerInput[] = lease
    ? [
        {
          role: 'AGENCY',
          name: profile?.full_name ? `${profile.full_name} (${agencyName})` : agencyName,
          profile_id: user?.id ?? null,
          email: profile?.email ?? null,
        },
        {
          role: 'TENANT',
          name: lease.tenant_name,
          document: lease.tenant_document,
          email: lease.tenant_email,
          phone: lease.tenant_phone,
          profile_id: lease.tenant_profile_id,
        },
        ...guarantors.map(
          (item): SignerInput => ({
            role: 'GUARANTOR',
            name: item.name,
            document: item.document,
            email: item.email,
            phone: item.phone,
          }),
        ),
        ...(includeOwner && ownerName
          ? [
              {
                role: 'OWNER' as const,
                name: ownerName,
                document: agreement?.owner_document ?? null,
                email: agreement?.owner_email ?? null,
                phone: agreement?.owner_phone ?? property?.owner_phone ?? null,
                profile_id: agreement?.owner_profile_id ?? property?.owner_profile_id ?? null,
              },
            ]
          : []),
      ]
    : []

  // ------------------------------------------------------------ codeudores
  const guarantorForm = useForm<GuarantorFormValues>({
    resolver: zodResolver(guarantorSchema),
    defaultValues: { name: '', document: '', phone: '', email: '' },
  })
  const addGuarantor = guarantorForm.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const blank = (value: string) => value.trim() || null
    mutations.addGuarantor.mutate(
      {
        condominium_id: currentCondominiumId,
        lease_id: leaseId,
        name: values.name,
        document: blank(values.document),
        phone: blank(values.phone),
        email: blank(values.email),
      },
      {
        onSuccess: () => {
          guarantorForm.reset()
          // El texto se vuelve a armar con el codeudor nuevo.
          if (editable) setText(null)
        },
      },
    )
  })

  // --------------------------------------------------------------- enlaces
  const [links, setLinks] = useState<Record<string, string>>({})
  const getLink = (signerId: string) =>
    mutations.signingLink.mutate(signerId, {
      onSuccess: (url) => {
        setLinks((current) => ({ ...current, [signerId]: url }))
        void navigator.clipboard?.writeText(url).then(
          () => notify.success('Enlace copiado. El anterior ya no sirve.'),
          () => undefined,
        )
      },
      onError: (error) => notify.error(getErrorMessage(error)),
    })

  const signedCount = signers.filter((signer) => signer.signed_at).length

  return {
    loading: leasesQuery.isLoading,
    notFound: !leasesQuery.isLoading && !lease,
    backHref: '/agency/leases',
    title: property?.title ?? lease?.property?.title ?? 'Contrato',
    tenant: lease?.tenant_name ?? '',
    status,
    statusLabel: CONTRACT_STATUS[status].label,
    statusColor: CONTRACT_STATUS[status].color,
    editable,
    progress: signers.length ? `${signedCount} de ${signers.length} firmas` : null,
    hash: lease?.contract_hash ?? null,
    sentAt: lease?.contract_sent_at ? formatDateTime(lease.contract_sent_at) : null,
    signedAt: lease?.contract_signed_at ? formatDateTime(lease.contract_signed_at) : null,

    text: status === 'NONE' ? currentText : (lease?.contract_text ?? ''),
    setText: (value: string) => setText(value),
    resetText: () => setText(null),
    isCustomText: text !== null && text !== template,

    guarantors: guarantors.map((item) => ({
      id: item.id,
      name: item.name,
      detail: [item.document && `Doc. ${item.document}`, item.phone, item.email]
        .filter(Boolean)
        .join(' · '),
    })),
    guarantorControl: guarantorForm.control,
    addGuarantor,
    addingGuarantor: mutations.addGuarantor.isPending,
    removeGuarantor: (id: string) =>
      mutations.removeGuarantor.mutate(id, {
        onSuccess: () => {
          if (editable) setText(null)
        },
      }),

    canIncludeOwner: Boolean(ownerName),
    includeOwner,
    setIncludeOwner,
    proposedSigners: proposedSigners.map((signer, index) => ({
      key: `${signer.role}-${index}`,
      role: SIGNER_ROLES[signer.role],
      name: signer.name,
      hasAccount: Boolean(signer.profile_id),
    })),
    send: () => {
      if (!lease) return
      mutations.sendForSignature.mutate({
        leaseId,
        text: currentText,
        signers: proposedSigners,
      })
    },
    sending: mutations.sendForSignature.isPending,
    sendError: mutations.sendForSignature.error
      ? getErrorMessage(mutations.sendForSignature.error)
      : null,
    cancel: () => mutations.cancelSignature.mutate(leaseId),
    cancelling: mutations.cancelSignature.isPending,

    signers: signers.map((signer) => {
      const link = links[signer.id] ?? null
      return {
        id: signer.id,
        role: SIGNER_ROLES[signer.role],
        name: signer.name,
        signed: Boolean(signer.signed_at),
        signedLabel: signer.signed_at
          ? `Firmo ${signer.signed_name ?? ''} el ${formatDateTime(signer.signed_at)}`
          : 'Pendiente',
        evidence: signer.signed_at
          ? [
              signer.signed_document && `Documento ${signer.signed_document}`,
              signer.ip && `IP ${signer.ip}`,
              signer.user_agent && signer.user_agent.slice(0, 80),
            ]
              .filter(Boolean)
              .join(' · ')
          : null,
        signature: signer.signature_image,
        isMe: signer.profile_id !== null && signer.profile_id === user?.id,
        link,
        whatsapp: link
          ? whatsappHref(
              signer.phone,
              `Hola ${signer.name}, te enviamos el contrato de arrendamiento de ${property?.title ?? 'la propiedad'} para que lo leas y lo firmes: ${link}`,
            )
          : null,
      }
    }),
    getLink,
    gettingLink: mutations.signingLink.isPending,
    /** La inmobiliaria firma desde aqui mismo (su firmante es el usuario actual). */
    signNow: (signerId: string) =>
      mutations.signingLink.mutate(signerId, {
        onSuccess: (url) => window.location.assign(url),
        onError: (error) => notify.error(getErrorMessage(error)),
      }),
    print: () => window.print(),
  }
}

export type LeaseContractViewModel = ReturnType<typeof useLeaseContractViewModel>
