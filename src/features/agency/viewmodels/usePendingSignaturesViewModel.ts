import { useAuth } from '@/hooks/useAuth'
import { useAgencyLeases } from '@/hooks/useAgency'
import { useAgencyManagementMutations, useMyPendingSigners } from '@/hooks/useAgencyManagement'
import { getErrorMessage } from '@/lib/errors'
import { notify } from '@/lib/notify'
import { SIGNER_ROLES } from '../management.logic'

/**
 * Contratos que el usuario tiene por firmar (como arrendatario, propietario,
 * codeudor o representante de la inmobiliaria). Al tocar "Leer y firmar" se
 * pide un enlace nuevo y se abre la pagina de firma.
 */
export function usePendingSignaturesViewModel() {
  const { user, currentCondominiumId } = useAuth()
  const signersQuery = useMyPendingSigners(user?.id)
  const leasesQuery = useAgencyLeases(currentCondominiumId)
  const mutations = useAgencyManagementMutations()

  const pending = (signersQuery.data ?? []).filter(
    (signer) => signer.condominium_id === currentCondominiumId,
  )
  return {
    items: pending.map((signer) => {
      const lease = (leasesQuery.data ?? []).find((item) => item.id === signer.lease_id)
      return {
        id: signer.id,
        title: lease?.property?.title
          ? `Contrato de ${lease.property.title}`
          : 'Contrato de arrendamiento',
        role: SIGNER_ROLES[signer.role],
      }
    }),
    open: (signerId: string) =>
      mutations.signingLink.mutate(signerId, {
        onSuccess: (url) => window.location.assign(url),
        onError: (error) => notify.error(getErrorMessage(error)),
      }),
    opening: mutations.signingLink.isPending,
  }
}
