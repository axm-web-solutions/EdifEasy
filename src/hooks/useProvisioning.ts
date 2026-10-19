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
