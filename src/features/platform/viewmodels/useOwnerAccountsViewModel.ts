import { useState } from 'react'
import { useProvisionExistingAccounts } from '@/hooks/useProvisioning'
import { getErrorMessage } from '@/lib/errors'
import { EXPORTERS } from '@/utils/export'
import {
  CREDENTIAL_COLUMNS,
  EMAIL_SLUG_PATTERN,
  RESIDENT_EMAIL_DOMAIN,
  emailSlug,
  unitEmail,
  type ProvisionedAccount,
} from './rut.logic'

/**
 * Crea las cuentas de propietario de un conjunto que ya existe (una por cada
 * unidad sin propietario), p. ej. Angeles del Bosque. Solo SUPER_ADMIN.
 */
export function useOwnerAccountsViewModel() {
  const mutation = useProvisionExistingAccounts()
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const [slug, setSlug] = useState('')

  const accounts: (ProvisionedAccount & { existing: boolean })[] = (
    mutation.data?.accounts ?? []
  ).map((account) => ({ ...account, role: 'Propietario' }))
  const slugValid = EMAIL_SLUG_PATTERN.test(slug)

  return {
    open: Boolean(target),
    condominiumName: target?.name ?? '',
    start: (condominium: { id: string; name: string }) => {
      mutation.reset()
      setTarget(condominium)
      setSlug(emailSlug(condominium.name))
    },
    close: () => setTarget(null),
    slug,
    setSlug: (value: string) => setSlug(value.toLowerCase().replace(/[^a-z0-9]/g, '')),
    slugValid,
    example: slugValid ? unitEmail(slug, '01') : `01.conjunto@${RESIDENT_EMAIL_DOMAIN}`,
    creating: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
    create: () => {
      if (target && slugValid) mutation.mutate({ condominiumId: target.id, emailSlug: slug })
    },
    done: Boolean(mutation.data),
    accounts,
    download: () =>
      EXPORTERS.csv.run(accounts, CREDENTIAL_COLUMNS, `credenciales-propietarios-${slug}`),
  }
}

export type OwnerAccountsViewModel = ReturnType<typeof useOwnerAccountsViewModel>
