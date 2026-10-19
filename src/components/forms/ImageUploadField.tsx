import { Button, Form, Upload } from 'antd'
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { useImageUpload } from '@/hooks/useImageUpload'
import { getErrorMessage } from '@/lib/errors'
import type { MediaEntity } from '@/services/mediaService'

interface ImageUploadFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: Path<TFieldValues>
  label: string
  condominiumId: string | null
  entity: MediaEntity
  help?: string
  /** Vista previa cuadrada (logos) o panoramica (fotos). */
  shape?: 'square' | 'wide'
}

/**
 * Campo de imagen: sube el archivo (reducido) y guarda su URL publica en el
 * formulario. Reemplaza los antiguos campos "Imagen (URL)".
 */
export function ImageUploadField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  condominiumId,
  entity,
  help,
  shape = 'wide',
}: ImageUploadFieldProps<TFieldValues>) {
  const upload = useImageUpload(condominiumId, entity)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string | null | undefined) || ''
        const error =
          fieldState.error?.message ?? (upload.error ? getErrorMessage(upload.error) : undefined)
        const picker = (children: React.ReactNode) => (
          <Upload
            accept="image/png,image/jpeg,image/webp"
            showUploadList={false}
            disabled={upload.isPending}
            beforeUpload={(file) => {
              upload.mutate(file, { onSuccess: (url) => field.onChange(url) })
              return false
            }}
          >
            {children}
          </Upload>
        )
        return (
          <Form.Item
            label={label}
            layout="vertical"
            validateStatus={error ? 'error' : undefined}
            help={error ?? help}
          >
            {value ? (
              <div className="space-y-2">
                <img
                  src={value}
                  alt=""
                  className={
                    shape === 'square'
                      ? 'h-24 w-24 rounded-lg border border-slate-200 bg-white object-contain p-1'
                      : 'max-h-56 w-full rounded-lg border border-slate-200 object-cover'
                  }
                />
                <div className="flex flex-wrap gap-2">
                  {picker(
                    <Button size="small" icon={<RefreshCw size={14} />} loading={upload.isPending}>
                      Cambiar
                    </Button>,
                  )}
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={() => field.onChange('')}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ) : (
              picker(
                <Button icon={<ImagePlus size={16} />} loading={upload.isPending}>
                  {upload.isPending ? 'Subiendo...' : 'Subir imagen'}
                </Button>,
              )
            )}
          </Form.Item>
        )
      }}
    />
  )
}
