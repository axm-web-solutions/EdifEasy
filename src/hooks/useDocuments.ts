import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentService, type UploadDocumentInput } from '@/services/documentService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { DocumentRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useDocuments(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.documents.list(condominiumId ?? '', params),
    queryFn: () => documentService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useDocumentCategories(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.documents.categories(condominiumId ?? ''),
    queryFn: () => documentService.categories(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 120_000,
  })
}

export function useDocumentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['documents'] })
    void queryClient.invalidateQueries({ queryKey: ['document-categories'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const upload = useMutation({
    mutationFn: (input: UploadDocumentInput) => documentService.upload(input),
    onSuccess: () => {
      notify.success('Documento subido correctamente')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'documents'> }) =>
      documentService.update(id, values),
    onSuccess: () => {
      notify.success('Documento actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (document: Pick<DocumentRow, 'id' | 'bucket' | 'file_path'>) =>
      documentService.remove(document),
    onSuccess: () => {
      notify.success('Documento eliminado')
      invalidate()
    },
  })

  const download = useMutation({
    mutationFn: (document: Pick<DocumentRow, 'id' | 'bucket' | 'file_path' | 'file_name'>) =>
      documentService.download(document),
  })

  const createCategory = useMutation({
    mutationFn: (values: TablesInsert<'document_categories'>) =>
      documentService.createCategory(values),
    onSuccess: () => {
      notify.success('Categoria creada')
      invalidate()
    },
  })

  const removeCategory = useMutation({
    mutationFn: (id: string) => documentService.removeCategory(id),
    onSuccess: () => {
      notify.success('Categoria eliminada')
      invalidate()
    },
  })

  return { upload, update, remove, download, createCategory, removeCategory }
}
