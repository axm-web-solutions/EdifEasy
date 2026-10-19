import { Alert, Button, Checkbox, Form, Spin, Upload } from 'antd'
import { Controller } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  NumberField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import type { ClassifiedsViewModel } from '../viewmodels/useClassifiedsViewModel'

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'USED', label: 'Usado' },
]
const MODALITY_OPTIONS = [
  { value: 'IN_PERSON', label: 'Presencial' },
  { value: 'ONLINE', label: 'Virtual' },
  { value: 'BOTH', label: 'Presencial o virtual' },
]

/** Formulario para publicar o editar un clasificado, con fotos. */
export function ListingFormDrawer({ vm }: { vm: ClassifiedsViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title={vm.formTitle}
      description={vm.approvalNote}
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting || vm.uploading > 0}
      submitLabel="Publicar"
      width={560}
    >
      <form onSubmit={vm.submit} noValidate>
        <SelectField
          control={vm.control}
          name="category"
          label="Que vas a publicar"
          required
          options={vm.categoryOptions}
          help={vm.categoryHint}
        />
        <TextField control={vm.control} name="title" label="Titulo" required maxLength={120} />
        <TextAreaField
          control={vm.control}
          name="description"
          label="Descripcion"
          required
          rows={4}
          maxLength={3000}
        />

        <div className="mb-4">
          <p className="mb-2 mt-0 text-sm text-slate-700">
            Fotos ({vm.images.length}/{vm.maxImages})
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {vm.images.map((image) => (
              <div
                key={image.path}
                className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
              >
                {image.url ? (
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Spin size="small" />
                  </div>
                )}
                <Button
                  size="small"
                  shape="circle"
                  aria-label="Quitar foto"
                  icon={<X size={12} />}
                  className="!absolute right-1 top-1"
                  onClick={() => vm.removeImage(image.path)}
                />
              </div>
            ))}
            {Array.from({ length: vm.uploading }, (_, index) => (
              <div
                key={`up-${index}`}
                className="flex aspect-square items-center justify-center rounded-lg bg-slate-100"
              >
                <Spin size="small" />
              </div>
            ))}
            {vm.canAddImages ? (
              <Upload
                accept="image/png,image/jpeg,image/webp"
                multiple
                showUploadList={false}
                beforeUpload={(file, fileList) => {
                  // antd llama una vez por archivo: se procesa el lote con el primero.
                  if (file === fileList[0]) vm.addFiles(fileList)
                  return false
                }}
              >
                <button
                  type="button"
                  className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white text-xs text-slate-500 hover:border-brand-400"
                >
                  <ImagePlus size={20} />
                  Agregar
                </button>
              </Upload>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <SelectField
            control={vm.control}
            name="price_type"
            label="Precio"
            required
            options={vm.priceTypeOptions}
          />
          {vm.showPrice ? (
            <NumberField
              control={vm.control}
              name="price"
              label="Valor (COP)"
              min={0}
              help="Vacio = a convenir"
            />
          ) : null}
          {vm.showCondition ? (
            <SelectField
              control={vm.control}
              name="item_condition"
              label="Estado"
              options={CONDITION_OPTIONS}
            />
          ) : null}
          {vm.showModality ? (
            <SelectField
              control={vm.control}
              name="modality"
              label="Modalidad"
              options={MODALITY_OPTIONS}
            />
          ) : null}
        </div>

        {vm.showProperty ? (
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            <NumberField
              control={vm.control}
              name="bedrooms"
              label="Habitaciones"
              min={0}
              max={99}
            />
            <NumberField control={vm.control} name="bathrooms" label="Banos" min={0} max={99} />
            <NumberField control={vm.control} name="area_m2" label="Area (m2)" min={0} />
            <SwitchField control={vm.control} name="parking" label="Parqueadero" />
          </div>
        ) : null}
        {vm.showDelivery ? (
          <SwitchField
            control={vm.control}
            name="delivery"
            label="Entrego a domicilio en el conjunto"
          />
        ) : null}
        <TextField
          control={vm.control}
          name="schedule"
          label="Horario o disponibilidad (opcional)"
          maxLength={80}
          placeholder="Ej. Lunes a viernes 6-9 pm"
        />

        {vm.apartmentOptions.length > 0 ? (
          <SelectField
            control={vm.control}
            name="apartment_id"
            label="Mostrar mi apartamento"
            options={vm.apartmentOptions}
            help="Opcional: ayuda a los vecinos a saber quien vende."
          />
        ) : null}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField
            control={vm.control}
            name="contact_phone"
            label="Telefono"
            placeholder="310 000 0000"
          />
          <TextField
            control={vm.control}
            name="contact_whatsapp"
            label="WhatsApp"
            placeholder="310 000 0000"
          />
        </div>

        {vm.needsDocument ? (
          <div className="mb-4 rounded-lg bg-slate-50 p-3">
            <p className="mb-2 mt-0 text-xs text-slate-600">
              La ley (Ley 1480 de 2011, art. 53) exige un registro de quienes venden. Tu documento
              no se muestra a los vecinos: solo lo ven la administracion y el operador si hay un
              reclamo.
            </p>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
              <SelectField
                control={vm.control}
                name="document_type"
                label="Tipo"
                options={vm.documentTypeOptions}
              />
              <TextField
                control={vm.control}
                name="document_number"
                label="Numero de documento"
                required
                maxLength={30}
                className="sm:col-span-2"
              />
            </div>
          </div>
        ) : null}
        {vm.needsRules ? (
          <Controller
            control={vm.control}
            name="accept_rules"
            render={({ field, fieldState }) => (
              <Form.Item
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Checkbox
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                >
                  Acepto las{' '}
                  <Link to="/legal/marketplace" target="_blank" rel="noopener">
                    reglas del marketplace
                  </Link>{' '}
                  y entiendo que EdiFeasy no es parte de la venta.
                </Checkbox>
              </Form.Item>
            )}
          />
        ) : null}

        {vm.uploading > 0 ? <Alert type="info" showIcon message="Subiendo fotos..." /> : null}
      </form>
    </FormDrawer>
  )
}
