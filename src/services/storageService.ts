import { supabase, type StorageBucket } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { AttachmentMeta } from '@/types/models'

/**
 * Limite REAL de cada bucket en Supabase Storage.
 *
 * Debe coincidir con `storage.buckets.file_size_limit`. Si el cliente acepta un
 * archivo que Storage rechaza, el usuario solo ve un error opaco de bucket:
 * `avatars` esta en 2 MB (no 25 MB) y `signatures` en 5 MB.
 */
const BUCKET_MAX_SIZE: Record<StorageBucket, number> = {
  documents: 25 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
  'incident-evidence': 25 * 1024 * 1024,
  invoices: 25 * 1024 * 1024,
  announcements: 25 * 1024 * 1024,
  signatures: 5 * 1024 * 1024,
  'report-images': 25 * 1024 * 1024,
  marketplace: 5 * 1024 * 1024,
  media: 5 * 1024 * 1024,
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
])

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 120)
}

/**
 * Convencion de rutas en Storage:
 *   <condominium_id>/<entidad>/<timestamp>-<nombre>
 * Las politicas de `storage.objects` leen el primer segmento para aislar
 * tenants; por eso TODA ruta debe empezar por el id del condominio
 * (excepto `avatars`, que usa el id del usuario).
 */
export function buildStoragePath(condominiumId: string, entity: string, fileName: string): string {
  return `${condominiumId}/${entity}/${Date.now()}-${sanitizeFileName(fileName)}`
}

function validateFile(bucket: StorageBucket, file: File): void {
  const maxSize = BUCKET_MAX_SIZE[bucket]
  if (file.size > maxSize) {
    throw toAppError({
      message: `El archivo supera el limite de ${Math.round(maxSize / 1024 / 1024)} MB.`,
    })
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw toAppError({
      message: 'Tipo de archivo no permitido. Usa PDF, imagenes, Word, Excel o texto.',
    })
  }
}

export const storageService = {
  async upload(
    bucket: StorageBucket,
    path: string,
    file: File,
    options: { upsert?: boolean } = {},
  ): Promise<AttachmentMeta> {
    validateFile(bucket, file)

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: options.upsert ?? false,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    })
    if (error) throw toAppError(error)

    return {
      bucket,
      path,
      name: file.name,
      size: file.size,
      mime_type: file.type || null,
    }
  },

  /** URL firmada temporal. Los buckets privados nunca se exponen publicamente. */
  async signedUrl(bucket: StorageBucket, path: string, expiresIn = 300): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error) throw toAppError(error)
    return data.signedUrl
  },

  async download(bucket: StorageBucket, path: string, fileName: string): Promise<void> {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    if (error) throw toAppError(error)

    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  },

  async remove(bucket: StorageBucket, paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove(paths)
    if (error) throw toAppError(error)
  },

  /** Avatares: bucket publico, ruta <user_id>/avatar.<ext>. */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${userId}/avatar-${Date.now()}.${extension}`

    await storageService.upload('avatars', path, file, { upsert: true })
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  },
}
