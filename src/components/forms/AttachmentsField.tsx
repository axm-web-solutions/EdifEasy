import { useCallback, useState } from 'react'
import { Button, List, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { Download, Paperclip, Trash2, Upload as UploadIcon } from 'lucide-react'
import { buildStoragePath, storageService } from '@/services/storageService'
import type { StorageBucket } from '@/lib/supabase'
import type { AttachmentMeta } from '@/types/models'
import type { Json } from '@/types/database'
import { formatFileSize } from '@/utils/format'
import { notify } from '@/lib/notify'
import { getErrorMessage } from '@/lib/errors'

const { Text } = Typography

/** Convierte la columna `jsonb` de adjuntos en un arreglo tipado. */
export function parseAttachments(value: Json | null | undefined): AttachmentMeta[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is AttachmentMeta =>
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).path === 'string' &&
      typeof (item as Record<string, unknown>).bucket === 'string',
  )
}

export interface AttachmentUploader {
  fileList: UploadFile[]
  setFileList: (files: UploadFile[]) => void
  existing: AttachmentMeta[]
  removeExisting: (path: string) => void
  reset: (initial?: AttachmentMeta[]) => void
  /** Sube los archivos pendientes y devuelve la lista final de adjuntos. */
  commit: () => Promise<AttachmentMeta[]>
  uploading: boolean
}

/**
 * Gestiona los adjuntos de un formulario: conserva los ya guardados, acumula
 * los nuevos y los sube a Storage justo antes de guardar el registro.
 */
export function useAttachmentUploader(
  condominiumId: string | null,
  bucket: StorageBucket,
  entity: string,
): AttachmentUploader {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [existing, setExisting] = useState<AttachmentMeta[]>([])
  const [uploading, setUploading] = useState(false)

  const reset = useCallback((initial: AttachmentMeta[] = []) => {
    setExisting(initial)
    setFileList([])
  }, [])

  const removeExisting = useCallback((path: string) => {
    setExisting((previous) => previous.filter((attachment) => attachment.path !== path))
  }, [])

  const commit = useCallback(async (): Promise<AttachmentMeta[]> => {
    if (!condominiumId || fileList.length === 0) return existing

    setUploading(true)
    const uploaded: AttachmentMeta[] = []
    try {
      for (const item of fileList) {
        const file = item.originFileObj
        if (!file) continue
        const path = buildStoragePath(condominiumId, entity, file.name)
        uploaded.push(await storageService.upload(bucket, path, file))
      }
      setFileList([])
      const next = [...existing, ...uploaded]
      setExisting(next)
      return next
    } finally {
      setUploading(false)
    }
  }, [bucket, condominiumId, entity, existing, fileList])

  return { fileList, setFileList, existing, removeExisting, reset, commit, uploading }
}

export function AttachmentsField({
  uploader,
  label = 'Adjuntos',
  help = 'PDF, imagenes, Word, Excel o texto. Maximo 25 MB por archivo.',
  disabled = false,
}: {
  uploader: AttachmentUploader
  label?: string
  help?: string
  disabled?: boolean
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm text-slate-700">{label}</p>

      {uploader.existing.length > 0 ? (
        <List
          size="small"
          className="mb-2 rounded-lg border border-slate-100"
          dataSource={uploader.existing}
          renderItem={(attachment) => (
            <List.Item
              actions={[
                <Button
                  key="remove"
                  size="small"
                  type="text"
                  danger
                  disabled={disabled}
                  icon={<Trash2 size={13} />}
                  onClick={() => uploader.removeExisting(attachment.path)}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={<Paperclip size={15} className="mt-1 text-slate-400" />}
                title={<span className="text-sm">{attachment.name}</span>}
                description={
                  <Text type="secondary" className="text-xs">
                    {formatFileSize(attachment.size)}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      ) : null}

      <Upload
        multiple
        disabled={disabled}
        fileList={uploader.fileList}
        beforeUpload={() => false}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
        onChange={(info) => uploader.setFileList(info.fileList)}
        onRemove={(file) =>
          uploader.setFileList(uploader.fileList.filter((item) => item.uid !== file.uid))
        }
      >
        <Button icon={<UploadIcon size={15} />} disabled={disabled}>
          Seleccionar archivos
        </Button>
      </Upload>

      <p className="mt-1 mb-0 text-xs text-slate-400">{help}</p>
    </div>
  )
}

/** Lista de adjuntos con descarga, para las vistas de detalle. */
export function AttachmentsList({
  attachments,
  emptyText = 'Sin adjuntos',
}: {
  attachments: AttachmentMeta[]
  emptyText?: string
}) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (attachment: AttachmentMeta) => {
    setDownloading(attachment.path)
    try {
      await storageService.download(
        attachment.bucket as StorageBucket,
        attachment.path,
        attachment.name,
      )
    } catch (error) {
      notify.error(getErrorMessage(error))
    } finally {
      setDownloading(null)
    }
  }

  if (attachments.length === 0) {
    return (
      <Text type="secondary" className="text-sm">
        {emptyText}
      </Text>
    )
  }

  return (
    <List
      size="small"
      dataSource={attachments}
      renderItem={(attachment) => (
        <List.Item
          actions={[
            <Button
              key="download"
              size="small"
              icon={<Download size={13} />}
              loading={downloading === attachment.path}
              onClick={() => void handleDownload(attachment)}
            />,
          ]}
        >
          <List.Item.Meta
            avatar={<Paperclip size={15} className="mt-1 text-slate-400" />}
            title={<span className="text-sm">{attachment.name}</span>}
            description={
              <Text type="secondary" className="text-xs">
                {formatFileSize(attachment.size)}
              </Text>
            }
          />
        </List.Item>
      )}
    />
  )
}
