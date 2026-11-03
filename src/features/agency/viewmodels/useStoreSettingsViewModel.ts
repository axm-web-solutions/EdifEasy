import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyMutations, usePaymentAccount, useStoreSettings } from '@/hooks/useAgency'
import { env } from '@/lib/env'
import { getErrorMessage } from '@/lib/errors'
import {
  storeSchema,
  type StoreFormValues,
  wompiAccountSchema,
  type WompiAccountFormValues,
} from '@/schemas/agency'
import { formatDate } from '@/utils/format'
import { slugify } from '../agency.logic'

/**
 * Tienda publica (enlace, descripcion, WhatsApp) y cuenta Wompi propia de la
 * inmobiliaria para recibir los pagos en linea directo en su cuenta.
 */
export function useStoreSettingsViewModel() {
  const { currentCondominiumId, currentMembership } = useAuth()
  const storeQuery = useStoreSettings(currentCondominiumId)
  const accountQuery = usePaymentAccount(currentCondominiumId)
  const mutations = useAgencyMutations()

  const storeForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { slug: '', description: '', phone: '', email: '', whatsapp: '' },
  })
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (loaded || !storeQuery.data) return
    storeForm.reset({
      slug: storeQuery.data.slug ?? slugify(currentMembership?.condominium_name ?? ''),
      description: storeQuery.data.description ?? '',
      phone: storeQuery.data.phone ?? '',
      email: storeQuery.data.email ?? '',
      whatsapp: storeQuery.data.whatsapp ?? '',
    })
    setLoaded(true)
  }, [storeQuery.data, loaded, storeForm, currentMembership?.condominium_name])

  const saveStore = storeForm.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const text = (value: string) => value.trim() || null
    mutations.saveStore.mutate({
      agencyId: currentCondominiumId,
      values: {
        slug: values.slug,
        description: text(values.description),
        phone: text(values.phone),
        email: text(values.email),
        whatsapp: text(values.whatsapp.replace(/\D/g, '')),
      },
    })
  })

  const accountForm = useForm<WompiAccountFormValues>({
    resolver: zodResolver(wompiAccountSchema),
    defaultValues: { public_key: '', integrity_secret: '', events_secret: '' },
  })
  const connect = accountForm.handleSubmit((values) => {
    if (!currentCondominiumId) return
    mutations.connectAccount.mutate(
      {
        condominiumId: currentCondominiumId,
        publicKey: values.public_key,
        integritySecret: values.integrity_secret,
        eventsSecret: values.events_secret,
      },
      { onSuccess: () => accountForm.reset() },
    )
  })

  const slug = storeQuery.data?.slug ?? null
  const account = accountQuery.data

  return {
    loading: storeQuery.isLoading,
    storeControl: storeForm.control,
    saveStore,
    savingStore: mutations.saveStore.isPending,
    storeError: mutations.saveStore.error ? getErrorMessage(mutations.saveStore.error) : null,
    publicUrl: slug ? `${window.location.origin}/i/${slug}` : null,

    account: account
      ? {
          environment: account.environment === 'SANDBOX' ? 'Pruebas (sandbox)' : 'Produccion',
          isSandbox: account.environment === 'SANDBOX',
          publicKey: `${account.public_key.slice(0, 12)}…${account.public_key.slice(-4)}`,
          connectedAt: formatDate(account.connected_at),
        }
      : null,
    accountControl: accountForm.control,
    connect,
    connecting: mutations.connectAccount.isPending,
    connectError: mutations.connectAccount.error
      ? getErrorMessage(mutations.connectAccount.error)
      : null,
    disconnect: () => {
      if (currentCondominiumId) mutations.disconnectAccount.mutate(currentCondominiumId)
    },
    webhookUrl: `${env.VITE_SUPABASE_URL}/functions/v1/wompi-webhook`,
  }
}

export type StoreSettingsViewModel = ReturnType<typeof useStoreSettingsViewModel>
