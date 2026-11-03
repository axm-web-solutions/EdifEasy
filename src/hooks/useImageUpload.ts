import { useMutation } from '@tanstack/react-query'
import { AppError } from '@/lib/errors'
import { mediaService, type MediaEntity } from '@/services/mediaService'

/** Sube una imagen publica del conjunto y devuelve su URL. */
export function useImageUpload(condominiumId: string | null, entity: MediaEntity) {
  return useMutation({
    mutationFn: (file: File) => {
      if (!condominiumId) throw new AppError('Selecciona un conjunto')
      return mediaService.uploadImage(condominiumId, entity, file)
    },
  })
}

/** Sube un video corto de portada (mp4/webm) y devuelve su URL publica. */
export function useVideoUpload(condominiumId: string | null) {
  return useMutation({
    mutationFn: (file: File) => {
      if (!condominiumId) throw new AppError('Selecciona un espacio')
      return mediaService.uploadVideo(condominiumId, file)
    },
  })
}
