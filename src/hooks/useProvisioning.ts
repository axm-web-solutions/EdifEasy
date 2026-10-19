import { useMutation, useQueryClient } from '@tanstack/react-query'
import { provisioningService, type ProvisionInput } from '@/services/provisioningService'
import { rutService } from '@/services/rutService'
import { notify } from '@/lib/notify'

/** Lee el texto del RUT (PDF) en el navegador. */
export function useReadRut() {
  return useMutation({
    meta: { silent: true },
    mutationFn: (file: File) => rutService.extractText(file),
  })
}

/** Alta completa del conjunto (Edge Function `provision-condominium`). */
export function useProvisionCondominium() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProvisionInput) => provisioningService.provision(input),
    onSuccess: () => {
      notify.success('Conjunto creado')
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
      // El selector de conjuntos del super admin debe mostrar el nuevo.
      void queryClient.invalidateQueries({ queryKey: ['super-admin-condominiums'] })
    },
  })
}

/** Cuentas de propietarios para un conjunto que ya existe. */
export function useProvisionExistingAccounts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ condominiumId, emailSlug }: { condominiumId: string; emailSlug: string }) =>
      provisioningService.provisionExisting(condominiumId, emailSlug),
    onSuccess: (data) => {
      notify.success(`Se crearon ${data.accounts.length} cuenta(s) de propietario`)
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
    },
  })
}
