import { useMutation } from '@tanstack/react-query'
import { mediaService, type MediaEntity } from '@/services/mediaService'

/** Sube una imagen publica del conjunto y devuelve su URL. */
export function useImageUpload(condominiumId: string | null, entity: MediaEntity) {
  return useMutation({
    mutationFn: (file: File) => {
      if (!condominiumId) throw new Error('Selecciona un conjunto')
      return mediaService.uploadImage(condominiumId, entity, file)
    },
  })
}
