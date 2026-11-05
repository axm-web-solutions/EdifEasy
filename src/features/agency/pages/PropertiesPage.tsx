import {
  Alert,
  Button,
  Card,
  Divider,
  Dropdown,
  Input,
  Segmented,
  Skeleton,
  Switch,
  Tag,
} from 'antd'
import {
  ExternalLink,
  ImageOff,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import {
  NumberField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { ImageGalleryField } from '@/components/forms/ImageGalleryField'
import { lazy, Suspense } from 'react'

const LocationPicker = lazy(() =>
  import('../components/LocationPicker').then((m) => ({ default: m.LocationPicker })),
)
import type { PropertyView } from '../agency.logic'
import {
  usePropertiesViewModel,
  type PropertiesViewModel,
  type PropertyFilter,
} from '../viewmodels/usePropertiesViewModel'

function PropertyCard({ item, vm }: { item: PropertyView; vm: PropertiesViewModel }) {
  return (
    <Card
      size="small"
      className="surface-card h-full overflow-hidden"
      styles={{ body: { padding: 0 } }}
    >
      <button
        type="button"
        className="block aspect-[4/3] w-full cursor-pointer border-0 bg-slate-100 p-0"
        onClick={() => vm.openEdit(item.id)}
        aria-label={`Editar ${item.title}`}
      >
        {item.cover ? (
          <img src={item.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full items-center justify-center text-slate-400">
            <ImageOff size={28} />
          </span>
        )}
      </button>
      <div className="space-y-1 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="m-0 text-xs text-slate-500">
              {item.typeLabel} · {item.operationLabel}
              {item.code ? ` · ${item.code}` : ''}
            </p>
          </div>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'edit',
                  label: 'Editar',
                  icon: <Pencil size={14} />,
                  onClick: () => vm.openEdit(item.id),
                },
                {
                  key: 'remove',
                  label: 'Eliminar',
                  danger: true,
                  icon: <Trash2 size={14} />,
                  onClick: async () => {
                    if (
                      await confirmDelete({
                        title: 'Eliminar propiedad',
                        content: 'Se borran tambien sus contratos y cobros.',
                      })
                    )
                      vm.remove(item.id)
                  },
                },
              ],
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreVertical size={16} />}
              aria-label={`Opciones de ${item.title}`}
            />
          </Dropdown>
        </div>
        <p className="m-0 text-base font-semibold text-slate-900">{item.price}</p>
        {item.priceExtra ? <p className="m-0 text-xs text-slate-500">{item.priceExtra}</p> : null}
        <p className="m-0 text-xs text-slate-600">{item.location}</p>
        {item.specs.length ? (
          <p className="m-0 text-xs text-slate-500">{item.specs.join(' · ')}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Tag color={item.statusColor} bordered={false} className="!m-0">
            {item.statusLabel}
          </Tag>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <Switch
              size="small"
              checked={item.isPublished}
              onChange={() => vm.togglePublished(item.id)}
            />
            En la tienda
          </label>
        </div>
        {item.ownerLabel ? (
          <p className="m-0 text-xs text-slate-400">Dueno: {item.ownerLabel}</p>
        ) : null}
      </div>
    </Card>
  )
}

function PropertyForm({ vm }: { vm: PropertiesViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title={vm.isEditing ? 'Editar propiedad' : 'Nueva propiedad'}
      description="Lo que marques como publicado aparece en tu tienda. La direccion exacta y el dueno nunca se muestran alli."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      width={640}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <ImageGalleryField
          control={vm.control}
          name="images"
          label="Fotos"
          condominiumId={vm.condominiumId}
          entity="properties"
          help="La primera es la portada. Hasta 15 fotos."
        />
        <TextField
          control={vm.control}
          name="title"
          label="Titulo"
          required
          placeholder="Ej: Apartamento con balcon en Cedritos"
        />
        <div className="grid gap-x-4 sm:grid-cols-3">
          <SelectField
            control={vm.control}
            name="property_type"
            label="Tipo"
            required
            showSearch={false}
            options={vm.typeOptions}
          />
          <SelectField
            control={vm.control}
            name="operation"
            label="Para"
            required
            showSearch={false}
            options={vm.operationOptions}
          />
          <SelectField
            control={vm.control}
            name="status"
            label="Estado"
            required
            showSearch={false}
            options={vm.statusOptions}
          />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-3">
          {vm.showRent ? (
            <NumberField
              control={vm.control}
              name="rent_price"
              label="Canon mensual"
              required
              min={0}
              addonBefore="$"
            />
          ) : null}
          <NumberField
            control={vm.control}
            name="admin_fee"
            label="Administracion"
            min={0}
            addonBefore="$"
          />
          {vm.showSale ? (
            <NumberField
              control={vm.control}
              name="sale_price"
              label="Precio de venta"
              required
              min={0}
              addonBefore="$"
            />
          ) : null}
        </div>

        <Divider className="!my-2" orientation="left" plain>
          Ubicacion
        </Divider>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField control={vm.control} name="city" label="Ciudad" />
          <TextField control={vm.control} name="neighborhood" label="Barrio" />
        </div>
        <TextField
          control={vm.control}
          name="address"
          label="Direccion (privada)"
          help="Solo la ve la inmobiliaria."
        />
        <div className="mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-700">Ubicacion en el mapa</span>
            <div className="flex gap-2">
              <Button
                size="small"
                icon={<MapPin size={14} />}
                loading={vm.locating}
                onClick={vm.locate}
              >
                Buscar la direccion
              </Button>
              {vm.location ? (
                <Button size="small" onClick={vm.clearLocation}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-slate-100" />}>
            <LocationPicker
              lat={vm.location?.lat ?? null}
              lng={vm.location?.lng ?? null}
              onChange={vm.setLocation}
            />
          </Suspense>
          <p className="m-0 mt-1 text-xs text-slate-500">
            {vm.locateMessage ??
              'Toca el mapa o arrastra el punto. En la tienda solo se ve la zona aproximada, nunca la direccion.'}
          </p>
        </div>

        <Divider className="!my-2" orientation="left" plain>
          Caracteristicas
        </Divider>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          <NumberField control={vm.control} name="area_m2" label="Area (m2)" min={0} />
          <NumberField control={vm.control} name="bedrooms" label="Habitaciones" min={0} max={50} />
          <NumberField control={vm.control} name="bathrooms" label="Banos" min={0} max={50} />
          <NumberField control={vm.control} name="parking" label="Parqueaderos" min={0} max={50} />
          <NumberField control={vm.control} name="stratum" label="Estrato" min={1} max={6} />
          <NumberField control={vm.control} name="floor" label="Piso" min={-5} max={200} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <SwitchField control={vm.control} name="furnished" label="Amoblado" />
          <SwitchField control={vm.control} name="pets_allowed" label="Admite mascotas" />
        </div>
        <TextAreaField
          control={vm.control}
          name="description"
          label="Descripcion"
          rows={4}
          maxLength={5000}
        />
        <Divider className="!my-2" orientation="left" plain>
          Tienda en ingles (opcional)
        </Divider>
        <TextField
          control={vm.control}
          name="title_en"
          label="Titulo en ingles"
          maxLength={140}
          placeholder="Ej: Apartment with balcony in Cedritos"
          help="Si lo dejas vacio, la tienda en ingles muestra el titulo en espanol."
        />
        <TextAreaField
          control={vm.control}
          name="description_en"
          label="Descripcion en ingles"
          rows={3}
          maxLength={5000}
        />
        <TextField
          control={vm.control}
          name="code"
          label="Referencia interna"
          placeholder="Ej: APT-104"
        />

        <Divider className="!my-2" orientation="left" plain>
          Propietario (privado)
        </Divider>
        <SelectField
          control={vm.control}
          name="owner_profile_id"
          label="Propietario con cuenta"
          allowClear
          options={vm.ownerOptions}
          help="Para que vea su propiedad en la app. Invitalo en Usuarios con el rol Propietario."
        />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField control={vm.control} name="owner_name" label="Nombre del propietario" />
          <TextField control={vm.control} name="owner_phone" label="Telefono del propietario" />
        </div>
        <SwitchField
          control={vm.control}
          name="is_published"
          label="Publicar en la tienda"
          checkedLabel="Publicada"
          uncheckedLabel="Oculta"
        />
      </form>
    </FormDrawer>
  )
}

export function PropertiesPage() {
  const vm = usePropertiesViewModel()

  return (
    <div>
      <PageHeader
        title="Propiedades"
        subtitle="Casas, apartamentos, locales, oficinas y mas: en arriendo, en venta o ambos."
        dataTour="agency-properties"
        actions={
          <>
            {vm.storeUrl ? (
              <Button
                icon={<ExternalLink size={16} />}
                href={vm.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver mi tienda
              </Button>
            ) : null}
            <Button type="primary" icon={<Plus size={16} />} onClick={vm.openNew}>
              Nueva propiedad
            </Button>
          </>
        }
      />

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Aun no tienes propiedades"
          description="Agrega la primera con fotos, precio y caracteristicas; luego publicala en tu tienda."
          action={
            <Button type="primary" onClick={vm.openNew}>
              Nueva propiedad
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="max-w-full overflow-x-auto">
              <Segmented
                value={vm.filter}
                onChange={(value) => vm.setFilter(value as PropertyFilter)}
                options={vm.filterOptions}
              />
            </div>
            <Input
              allowClear
              className="lg:max-w-xs"
              prefix={<Search size={14} className="text-slate-400" />}
              placeholder="Buscar por titulo, barrio o referencia"
              value={vm.search}
              onChange={(event) => vm.setSearch(event.target.value)}
            />
          </div>
          {vm.properties.length === 0 ? (
            <EmptyState title="Nada coincide con el filtro" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {vm.properties.map((item) => (
                <PropertyCard key={item.id} item={item} vm={vm} />
              ))}
            </div>
          )}
        </>
      )}

      <PropertyForm vm={vm} />
    </div>
  )
}
