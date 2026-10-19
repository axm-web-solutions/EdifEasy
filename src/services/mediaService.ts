/**
 * Imagenes publicas de la comunidad (bucket `media`): fotos de comunicados del
 * feed y logo del conjunto. Solo la administracion sube; se leen por URL publica.
 */
import { supabase } from '@/lib/supabase'
import { storageService } from './storageService'
import { compressImage } from '@/utils/image'

export type MediaEntity = 'announcements' | 'logo'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

export const mediaService = {
  async uploadImage(condominiumId: string, entity: MediaEntity, file: File): Promise<string> {
    if (!ALLOWED.includes(file.type)) throw new Error('Usa una imagen PNG, JPG o WEBP')
    // El logo conserva PNG (transparencia); las fotos se reducen a JPG.
    const prepared = entity === 'logo' ? file : await compressImage(file)
    const extension =
      prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${condominiumId}/${entity}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`
    await storageService.upload('media', path, prepared)
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  },
}
