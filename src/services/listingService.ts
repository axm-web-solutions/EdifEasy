/**
 * Clasificados del marketplace. RLS entrega a cada persona las publicaciones
 * aprobadas y vigentes, mas las suyas; a la administracion, todas. El estado y
 * la vigencia los controla la base (triggers y `review_marketplace_listing`).
 */
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { storageService } from './storageService'
import type { MarketplaceListingRow, TablesInsert, TablesUpdate } from '@/types/database'

export interface ListingWithRelations extends MarketplaceListingRow {
  author: { id: string; full_name: string } | null
  apartment: { id: string; number: string; building: { id: string; name: string } | null } | null
}

const SELECT = `
  *,
  author:profiles!marketplace_listings_created_by_fkey(id, full_name),
  apartment:apartments(id, number, building:buildings(id, name))
`

const BUCKET = 'marketplace' as const

export const listingService = {
  async list(condominiumId: string): Promise<ListingWithRelations[]> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select(SELECT)
      .eq('condominium_id', condominiumId)
      .order('published_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<ListingWithRelations[]>()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'marketplace_listings'>): Promise<MarketplaceListingRow> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert(values)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async update(
    id: string,
    values: TablesUpdate<'marketplace_listings'>,
  ): Promise<MarketplaceListingRow> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(listing: Pick<MarketplaceListingRow, 'id' | 'images'>): Promise<void> {
    const { error } = await supabase.from('marketplace_listings').delete().eq('id', listing.id)
    if (error) throw toAppError(error)
    const paths = Array.isArray(listing.images) ? (listing.images as string[]) : []
    // Las fotos se borran despues; si falla, quedan huerfanas pero inaccesibles.
    if (paths.length) await storageService.remove(BUCKET, paths).catch(() => undefined)
  },

  async review(id: string, approve: boolean, notes: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('review_marketplace_listing', {
      p_listing: id,
      p_approve: approve,
      p_notes: notes,
    })
    if (error) throw toAppError(error)
    return data
  },

  /** Sube una foto a <condominio>/listings/<usuario>/... y devuelve su ruta. */
  async uploadImage(condominiumId: string, userId: string, file: File): Promise<string> {
    const extension =
      file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${condominiumId}/listings/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`
    await storageService.upload(BUCKET, path, file)
    return path
  },

  async removeImages(paths: string[]): Promise<void> {
    if (paths.length) await storageService.remove(BUCKET, paths)
  },

  /** URLs firmadas (1 hora) para mostrar fotos del bucket privado. */
  async imageUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    if (error) throw toAppError(error)
    const urls: Record<string, string> = {}
    for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
    return urls
  },
}
