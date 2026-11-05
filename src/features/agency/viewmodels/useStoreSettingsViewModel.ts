import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyMutations, usePaymentAccount, useStoreSettings } from '@/hooks/useAgency'
import { useVideoUpload } from '@/hooks/useImageUpload'
import { env } from '@/lib/env'
import { getErrorMessage } from '@/lib/errors'
import {
  storeSchema,
  type StoreFormValues,
  wompiAccountSchema,
  type WompiAccountFormValues,
} from '@/schemas/agency'
import { resolvePrimaryColor } from '@/utils/brand'
import { formatDate } from '@/utils/format'
import { slugify } from '../agency.logic'

/**
 * Tienda publica (enlace, portada con foto o video, frase, color, WhatsApp) y
 * cuenta Wompi propia de la inmobiliaria para recibir los pagos en linea.
 */
export function useStoreSettingsViewModel() {
  const { currentCondominiumId, currentMembership } = useAuth()
  const storeQuery = useStoreSettings(currentCondominiumId)
  const accountQuery = usePaymentAccount(currentCondominiumId)
  const mutations = useAgencyMutations()
  const videoUpload = useVideoUpload(currentCondominiumId)

  const storeForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      slug: '',
      description: '',
      phone: '',
      email: '',
      whatsapp: '',
      hero_image: '',
      hero_video: '',
      tagline: '',
      tagline_en: '',
      description_en: '',
      primary_color: resolvePrimaryColor(null),
    },
  })
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (loaded || !storeQuery.data) return
    const data = storeQuery.data
    storeForm.reset({
      slug: data.slug ?? slugify(currentMembership?.condominium_name ?? ''),
      description: data.description ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      whatsapp: data.whatsapp ?? '',
      hero_image: data.heroImage ?? '',
      hero_video: data.heroVideo ?? '',
      tagline: data.tagline ?? '',
      tagline_en: data.taglineEn ?? '',
      description_en: data.descriptionEn ?? '',
      primary_color: resolvePrimaryColor(
        data.primaryColor ?? currentMembership?.condominium_primary_color,
      ),
    })
    setLoaded(true)
  }, [storeQuery.data, loaded, storeForm, currentMembership])

  const [heroImage, heroVideo, tagline, color] = useWatch({
    control: storeForm.control,
    name: ['hero_image', 'hero_video', 'tagline', 'primary_color'],
  })

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
        heroImage: text(values.hero_image),
        heroVideo: text(values.hero_video),
        tagline: text(values.tagline),
        taglineEn: text(values.tagline_en),
        descriptionEn: text(values.description_en),
        primaryColor: values.primary_color,
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
    condominiumId: currentCondominiumId,
    storeControl: storeForm.control,
    saveStore,
    savingStore: mutations.saveStore.isPending,
    storeError: mutations.saveStore.error ? getErrorMessage(mutations.saveStore.error) : null,
    publicUrl: slug ? `${window.location.origin}/i/${slug}` : null,

    // vista previa de la portada
    preview: {
      image: heroImage || null,
      video: heroVideo || null,
      tagline:
        tagline ||
        `Encuentra tu proximo hogar con ${currentMembership?.condominium_name ?? 'nosotros'}`,
      color: resolvePrimaryColor(color),
    },
    uploadVideo: (file: File) =>
      videoUpload.mutate(file, {
        onSuccess: (url) => storeForm.setValue('hero_video', url, { shouldDirty: true }),
      }),
    uploadingVideo: videoUpload.isPending,
    videoError: videoUpload.error ? getErrorMessage(videoUpload.error) : null,
    removeVideo: () => storeForm.setValue('hero_video', '', { shouldDirty: true }),

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
