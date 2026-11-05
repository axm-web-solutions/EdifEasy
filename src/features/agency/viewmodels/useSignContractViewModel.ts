import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useSigningView } from '@/hooks/useAgencyManagement'
import { agencyManagementService } from '@/services/agencyManagementService'
import { getErrorMessage } from '@/lib/errors'
import { signContractSchema, type SignContractFormValues } from '@/schemas/agency'
import { resolvePrimaryColor } from '@/utils/brand'
import { formatDateTime } from '@/utils/format'
import { SIGNER_ROLES } from '../management.logic'

/**
 * Pagina publica de firma (/firmar/:token). El token del enlace es la
 * credencial: no requiere sesion. Muestra el contrato, quienes faltan y el
 * formulario con nombre, documento y la firma dibujada.
 */
export function useSignContractViewModel(token: string) {
  const query = useSigningView(token)
  const view = query.data ?? null
  const [done, setDone] = useState<{ complete: boolean; at: string } | null>(null)
  const [read, setRead] = useState(false)

  useEffect(() => {
    document.title = view ? `Firmar contrato | ${view.agency.name}` : 'Firmar contrato'
  }, [view])

  const form = useForm<SignContractFormValues>({
    resolver: zodResolver(signContractSchema),
    defaultValues: { name: '', document: '', signature: '', accept: false },
  })
  useEffect(() => {
    if (!view) return
    form.reset({
      name: view.signer.name.replace(/\s*\(.*\)$/, ''),
      document: view.signer.document ?? '',
      signature: '',
      accept: false,
    })
  }, [view, form])

  const sign = useMutation({
    mutationFn: (values: SignContractFormValues) =>
      agencyManagementService.signContract({
        token,
        name: values.name,
        document: values.document,
        signature: values.signature,
        hash: view?.contract.hash ?? '',
        accept: values.accept,
      }),
    onSuccess: (data) => setDone({ complete: data.complete, at: formatDateTime(new Date().toISOString()) }),
  })

  const alreadySigned = Boolean(view?.signer.signed_at)
  const status = query.isLoading
    ? 'loading'
    : query.isError
      ? 'error'
      : !view
        ? 'invalid'
        : done || alreadySigned
          ? 'signed'
          : view.contract.status !== 'SENT'
            ? 'closed'
            : 'ready'

  return {
    status,
    accent: resolvePrimaryColor(view?.agency.primary_color),
    agency: view ? { name: view.agency.name, logo: view.agency.logo_url } : null,
    property: view?.contract.property ?? '',
    text: view?.contract.text ?? '',
    hash: view?.contract.hash ?? '',
    signerRole: view ? SIGNER_ROLES[view.signer.role] : '',
    signers: (view?.signers ?? []).map((signer, index) => ({
      key: `${signer.role}-${index}`,
      name: signer.name,
      role: SIGNER_ROLES[signer.role],
      signed: signer.signed || (done !== null && signer.name === view?.signer.name),
    })),
    doneMessage: done?.complete
      ? 'Todas las partes firmaron. El contrato quedo perfeccionado.'
      : 'Tu firma quedo registrada. Te avisaremos cuando firmen las demas partes.',
    signedAt: done?.at ?? (view?.signer.signed_at ? formatDateTime(view.signer.signed_at) : null),

    read,
    markRead: () => setRead(true),
    control: form.control,
    setSignature: (value: string | null) =>
      form.setValue('signature', value ?? '', { shouldValidate: form.formState.isSubmitted }),
    signatureError: form.formState.errors.signature?.message,
    submit: form.handleSubmit((values) => sign.mutate(values)),
    signing: sign.isPending,
    signError: sign.error ? getErrorMessage(sign.error) : null,
    print: () => window.print(),
  }
}

export type SignContractViewModel = ReturnType<typeof useSignContractViewModel>
