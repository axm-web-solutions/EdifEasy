import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLegalMutations, useMyAcceptances } from '@/hooks/useLegal'
import { getErrorMessage } from '@/lib/errors'
import { LEGAL_VERSION, pendingDocuments, type LegalDocumentKey } from '../legal.logic'

const LABELS: Record<LegalDocumentKey, { text: string; link: string; linkText: string }> = {
  TERMS: {
    text: 'He leido y acepto los',
    link: '/legal/terminos',
    linkText: 'terminos y condiciones',
  },
  PRIVACY: {
    text: 'Autorizo el tratamiento de mis datos personales segun la',
    link: '/legal/privacidad',
    linkText: 'politica de tratamiento de datos',
  },
  MARKETPLACE_RULES: {
    text: 'Acepto las',
    link: '/legal/marketplace',
    linkText: 'reglas del marketplace',
  },
}

/**
 * Aceptacion obligatoria en el ingreso (Ley 1581: autorizacion previa, expresa
 * e informada, con prueba). Aplica a toda cuenta que no haya aceptado la
 * version vigente: las creadas por la administracion, por invitacion o por el
 * alta desde el RUT, y a todos cuando cambian los textos.
 */
export function useLegalConsentViewModel() {
  const { user, signOut } = useAuth()
  const acceptancesQuery = useMyAcceptances(user?.id ?? null)
  const { accept } = useLegalMutations()
  const [checked, setChecked] = useState<Partial<Record<LegalDocumentKey, boolean>>>({})

  const pending = acceptancesQuery.data ? pendingDocuments(acceptancesQuery.data) : []
  // Si la consulta falla (p. ej. migracion pendiente) no se bloquea el acceso.
  const blocked = Boolean(acceptancesQuery.data) && pending.length > 0

  return {
    loading: acceptancesQuery.isLoading,
    blocked,
    isUpdate: (acceptancesQuery.data?.length ?? 0) > 0,
    items: pending.map((document) => ({
      document,
      ...LABELS[document],
      checked: Boolean(checked[document]),
    })),
    toggle: (document: LegalDocumentKey, value: boolean) =>
      setChecked((current) => ({ ...current, [document]: value })),
    canAccept: pending.every((document) => checked[document]),
    accepting: accept.isPending,
    error: accept.error ? getErrorMessage(accept.error) : null,
    accept: () =>
      accept.mutate(
        { documents: pending, version: LEGAL_VERSION },
        { onSuccess: () => void acceptancesQuery.refetch() },
      ),
    signOut: () => void signOut(),
  }
}
