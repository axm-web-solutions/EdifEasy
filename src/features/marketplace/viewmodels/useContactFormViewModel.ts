import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useDirectoryMutations } from '@/hooks/useDirectory'
import { contactSchema, type ContactFormValues } from '@/schemas/directory'
import { directoryCategories } from '@/constants/directory'
import type { CommunityContactKind, CommunityContactRow } from '@/types/database'

const emptyValues = (kind: CommunityContactKind): ContactFormValues => ({
  kind,
  category: '',
  name: '',
  phone: '',
  whatsapp: '',
  description: '',
  address: '',
  is_active: true,
})

/**
 * Formulario (drawer) para que la administracion agregue o edite numeros de
 * emergencia y servicios recomendados. Lo usan el feed y el marketplace.
 */
export function useContactFormViewModel() {
  const { currentCondominiumId, hasRole } = useAuth()
  const canManage = hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])
  const mutations = useDirectoryMutations()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommunityContactRow | null>(null)

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: emptyValues('SERVICE'),
  })
  const kind = useWatch({ control: form.control, name: 'kind' })

  const close = () => {
    setOpen(false)
    setEditing(null)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const payload = {
      kind: values.kind,
      category: values.category,
      name: values.name,
      phone: values.phone || null,
      whatsapp: values.whatsapp || null,
      description: values.description || null,
      address: values.address || null,
      is_active: values.is_active,
    }
    if (editing) {
      mutations.update.mutate({ id: editing.id, values: payload }, { onSuccess: close })
    } else {
      mutations.create.mutate(
        { ...payload, condominium_id: currentCondominiumId },
        { onSuccess: close },
      )
    }
  })

  return {
    canManage,
    open,
    editingId: editing?.id ?? null,
    title: editing
      ? 'Editar contacto'
      : kind === 'EMERGENCY'
        ? 'Nuevo numero de emergencia'
        : 'Nuevo servicio recomendado',
    description:
      kind === 'EMERGENCY'
        ? 'Lo veran todos los residentes en la tarjeta de emergencias del inicio.'
        : 'Aparece en el marketplace como recomendado por la administracion.',
    control: form.control,
    kind,
    categoryOptions: directoryCategories(kind).map(({ value, label }) => ({ value, label })),
    kindOptions: [
      { value: 'EMERGENCY', label: 'Numero de emergencia' },
      { value: 'SERVICE', label: 'Servicio (marketplace)' },
    ],
    submitting: mutations.create.isPending || mutations.update.isPending,
    openNew: (newKind: CommunityContactKind) => {
      setEditing(null)
      form.reset(emptyValues(newKind))
      setOpen(true)
    },
    openEdit: (contact: CommunityContactRow) => {
      setEditing(contact)
      form.reset({
        kind: contact.kind,
        category: contact.category,
        name: contact.name,
        phone: contact.phone ?? '',
        whatsapp: contact.whatsapp ?? '',
        description: contact.description ?? '',
        address: contact.address ?? '',
        is_active: contact.is_active,
      })
      setOpen(true)
    },
    close,
    submit,
    removeEditing: () => {
      if (!editing) return
      mutations.remove.mutate(editing.id, { onSuccess: close })
    },
  }
}

export type ContactFormViewModel = ReturnType<typeof useContactFormViewModel>
