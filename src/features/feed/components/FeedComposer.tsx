import { Button, Card } from 'antd'
import { PenSquare } from 'lucide-react'
import { SelectField, SwitchField, TextAreaField, TextField } from '@/components/forms/fields'
import { ImageUploadField } from '@/components/forms/ImageUploadField'
import type { FeedViewModel } from '../viewmodels/useFeedViewModel'

type Composer = NonNullable<FeedViewModel['composer']>

/** Caja para publicar en el feed (administracion y voceros). */
export function FeedComposer({ composer }: { composer: Composer }) {
  if (!composer.open) {
    return (
      <Card size="small" className="surface-card" data-tour="feed-composer">
        <button
          type="button"
          onClick={() => composer.setOpen(true)}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-left text-sm text-slate-500 transition hover:border-brand-400 hover:bg-brand-50"
        >
          <PenSquare size={18} className="shrink-0 text-brand-text" />
          Escribe una publicacion para la comunidad...
        </button>
      </Card>
    )
  }

  return (
    <Card
      size="small"
      className="surface-card"
      data-tour="feed-composer"
      title={<span className="text-sm font-semibold">Nueva publicacion</span>}
    >
      <form onSubmit={composer.submit} noValidate>
        <TextField
          control={composer.control}
          name="title"
          label="Titulo"
          required
          maxLength={150}
        />
        <TextAreaField
          control={composer.control}
          name="content"
          label="Mensaje"
          required
          rows={5}
          maxLength={8000}
        />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField
            control={composer.control}
            name="audience"
            label="Quien lo ve"
            required
            options={composer.audienceOptions}
          />
          {composer.audience === 'BUILDING' ? (
            <SelectField
              control={composer.control}
              name="building_id"
              label="Bloque o torre"
              required
              loading={composer.buildingsLoading}
              options={composer.buildingOptions}
            />
          ) : null}
          {composer.audience === 'ROLE' ? (
            <SelectField
              control={composer.control}
              name="audience_role_id"
              label="Grupo"
              required
              loading={composer.rolesLoading}
              options={composer.roleOptions}
            />
          ) : null}
        </div>
        <ImageUploadField
          control={composer.control}
          name="image_url"
          label="Imagen (opcional)"
          condominiumId={composer.condominiumId}
          entity="announcements"
        />
        <SwitchField control={composer.control} name="pinned" label="Fijar arriba del feed" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={composer.cancel} disabled={composer.submitting}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" loading={composer.submitting}>
            Publicar
          </Button>
        </div>
      </form>
    </Card>
  )
}
