import { supabase, type StorageBucket } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import { buildStoragePath, storageService } from './storageService'
import type {
  AudienceType,
  DocumentCategoryRow,
  DocumentRow,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'
import type { DocumentWithRelations, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  category:document_categories(id, name),
  uploader:profiles!documents_uploaded_by_fkey(id, full_name, email, avatar_url, phone)
`

export interface UploadDocumentInput {
  condominiumId: string
  file: File
  title: string
  description?: string | null
  categoryId?: string | null
  buildingId?: string | null
  apartmentId?: string | null
  visibility: AudienceType
  isRestricted: boolean
  uploadedBy: string
}

export const documentService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<DocumentWithRelations>> {
    const query = supabase
      .from('documents')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<DocumentWithRelations>(query, params, {
      searchColumns: ['title', 'description', 'file_name'],
      defaultSort: { column: 'created_at', ascending: false },
      dateColumn: 'created_at',
    })
  },

  async getById(id: string): Promise<DocumentWithRelations | null> {
    const { data, error } = await supabase
      .from('documents')
      .select(SELECT)
      .eq('id', id)
      .returns<DocumentWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  /** Sube el archivo a Storage y registra el metadato en PostgreSQL. */
  async upload(input: UploadDocumentInput): Promise<DocumentRow> {
    const path = buildStoragePath(input.condominiumId, 'documents', input.file.name)
    const uploaded = await storageService.upload('documents', path, input.file)

    const payload: TablesInsert<'documents'> = {
      condominium_id: input.condominiumId,
      category_id: input.categoryId ?? null,
      building_id: input.buildingId ?? null,
      apartment_id: input.apartmentId ?? null,
      title: input.title,
      description: input.description ?? null,
      bucket: 'documents',
      file_path: uploaded.path,
      file_name: input.file.name,
      file_size: input.file.size,
      mime_type: uploaded.mime_type,
      visibility: input.visibility,
      is_restricted: input.isRestricted,
      uploaded_by: input.uploadedBy,
    }

    const { data, error } = await supabase.from('documents').insert(payload).select('*').single()
    if (error) {
      // El registro fallo: no dejamos huerfano el archivo en Storage.
      await storageService.remove('documents', [uploaded.path]).catch(() => undefined)
      throw toAppError(error)
    }
    return data
  },

  async update(id: string, values: TablesUpdate<'documents'>): Promise<DocumentRow> {
    const { data, error } = await supabase
      .from('documents')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(document: Pick<DocumentRow, 'id' | 'bucket' | 'file_path'>): Promise<void> {
    const { error } = await supabase.from('documents').delete().eq('id', document.id)
    if (error) throw toAppError(error)
    await storageService
      .remove(document.bucket as StorageBucket, [document.file_path])
      .catch(() => undefined)
  },

  async download(document: Pick<DocumentRow, 'bucket' | 'file_path' | 'file_name' | 'id'>): Promise<void> {
    await storageService.download(
      document.bucket as StorageBucket,
      document.file_path,
      document.file_name,
    )
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      await supabase.from('audit_logs').insert({
        user_id: userData.user.id,
        action: 'DOWNLOAD',
        entity: 'documents',
        entity_id: document.id,
        metadata: { file: document.file_name },
      })
    }
  },

  async previewUrl(document: Pick<DocumentRow, 'bucket' | 'file_path'>): Promise<string> {
    return storageService.signedUrl(document.bucket as StorageBucket, document.file_path, 300)
  },

  // -------------------------------------------------------------------------
  // Categorias
  // -------------------------------------------------------------------------
  async categories(condominiumId: string): Promise<DocumentCategoryRow[]> {
    const { data, error } = await supabase
      .from('document_categories')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('name', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  async createCategory(values: TablesInsert<'document_categories'>): Promise<DocumentCategoryRow> {
    const { data, error } = await supabase
      .from('document_categories')
      .insert(values)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async removeCategory(id: string): Promise<void> {
    const { error } = await supabase.from('document_categories').delete().eq('id', id)
    if (error) throw toAppError(error)
  },
}
