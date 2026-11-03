import { Button, Upload } from 'antd'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { ImagePlus, Star, X } from 'lucide-react'
import { useImageUpload } from '@/hooks/useImageUpload'
import { getErrorMessage } from '@/lib/errors'
import type { MediaEntity } from '@/services/mediaService'

interface ImageGalleryFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: Path<TFieldValues>
  label: string
  condominiumId: string | null
  entity: MediaEntity
  max?: number
  help?: string
}

/**
 * Galeria de fotos publicas (bucket `media`). La primera es la portada; se
 * puede quitar cualquiera o pasarla al primer lugar.
 */
export function ImageGalleryField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  condominiumId,
  entity,
  max = 15,
  help,
}: ImageGalleryFieldProps<TFieldValues>) {
  const upload = useImageUpload(condominiumId, entity)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const images = (field.value as string[] | undefined) ?? []
        const set = (next: string[]) => field.onChange(next)
        return (
          <div className="mb-4">
            <span className="mb-1 block text-sm text-slate-700">{label}</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((url, index) => (
                <div
                  key={url}
                  className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      Portada
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="absolute left-1 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-white"
                      aria-label="Usar como portada"
                      onClick={() => set([url, ...images.filter((item) => item !== url)])}
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="absolute right-1 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-white"
                    aria-label="Quitar foto"
                    onClick={() => set(images.filter((item) => item !== url))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < max ? (
                <Upload
                  accept="image/png,image/jpeg,image/webp"
                  showUploadList={false}
                  multiple
                  disabled={upload.isPending}
                  beforeUpload={(file) => {
                    upload.mutate(file, {
                      onSuccess: (url) =>
                        field.onChange(
                          [...((field.value as string[] | undefined) ?? []), url].slice(0, max),
                        ),
                    })
                    return false
                  }}
                >
                  <Button
                    className="!flex aspect-[4/3] !h-auto w-full flex-col items-center justify-center gap-1"
                    loading={upload.isPending}
                    icon={<ImagePlus size={18} />}
                  >
                    <span className="text-xs">Agregar</span>
                  </Button>
                </Upload>
              ) : null}
            </div>
            {help ? <p className="m-0 mt-1 text-xs text-slate-500">{help}</p> : null}
            {upload.error ? (
              <p className="m-0 mt-1 text-xs text-red-600">{getErrorMessage(upload.error)}</p>
            ) : null}
          </div>
        )
      }}
    />
  )
}
