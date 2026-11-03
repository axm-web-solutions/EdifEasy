/**
 * Imagenes publicas de la comunidad (bucket `media`): fotos de comunicados del
 * feed y logo del conjunto. Solo la administracion sube; se leen por URL publica.
 */
import { supabase } from '@/lib/supabase'
import { AppError } from '@/lib/errors'
import { storageService } from './storageService'
import { compressImage } from '@/utils/image'

export type MediaEntity = 'announcements' | 'logo' | 'properties' | 'store'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

const VIDEO_TYPES = ['video/mp4', 'video/webm']
const VIDEO_MAX = 25 * 1024 * 1024

export const mediaService = {
  /** Video corto de portada (mp4/webm, hasta 25 MB) para la tienda. */
  async uploadVideo(condominiumId: string, file: File): Promise<string> {
    if (!VIDEO_TYPES.includes(file.type)) throw new AppError('Usa un video MP4 o WEBM')
    if (file.size > VIDEO_MAX) throw new AppError('El video debe pesar maximo 25 MB')
    const extension = file.type === 'video/webm' ? 'webm' : 'mp4'
    const path = `${condominiumId}/store/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`
    await storageService.upload('media', path, file)
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  },

  async uploadImage(condominiumId: string, entity: MediaEntity, file: File): Promise<string> {
    if (!ALLOWED.includes(file.type)) throw new AppError('Usa una imagen PNG, JPG o WEBP')
    // El logo conserva PNG (transparencia); las fotos se reducen a JPG.
    const prepared = entity === 'logo' ? file : await compressImage(file)
    const extension =
      prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${condominiumId}/${entity}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`
    await storageService.upload('media', path, prepared)
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  },
}
