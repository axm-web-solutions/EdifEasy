import { Button } from 'antd'
import { Trash2 } from 'lucide-react'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import { SelectField, SwitchField, TextAreaField, TextField } from '@/components/forms/fields'
import type { ContactFormViewModel } from '../viewmodels/useContactFormViewModel'

/** Drawer para agregar o editar un contacto del directorio del conjunto. */
export function ContactFormDrawer({ form }: { form: ContactFormViewModel }) {
  return (
    <FormDrawer
      open={form.open}
      title={form.title}
      description={form.description}
      onClose={form.close}
      onSubmit={form.submit}
      submitting={form.submitting}
      width={520}
      footerExtra={
        form.editingId ? (
          <Button
            danger
            icon={<Trash2 size={14} />}
            onClick={async () => {
              const ok = await confirmDelete({
                title: 'Eliminar contacto',
                content: 'Deja de aparecer para todos los residentes.',
              })
              if (ok) form.removeEditing()
            }}
          >
            Eliminar
          </Button>
        ) : null
      }
    >
      <form onSubmit={form.submit} noValidate>
        {!form.editingId ? (
          <SelectField control={form.control} name="kind" label="Tipo" required options={form.kindOptions} />
        ) : null}
        <SelectField
          control={form.control}
          name="category"
          label="Categoria"
          required
          options={form.categoryOptions}
        />
        <TextField
          control={form.control}
          name="name"
          label="Nombre"
          required
          maxLength={120}
          placeholder={form.kind === 'EMERGENCY' ? 'Cuadrante 12 - Policia' : 'Plomeria Don Jorge'}
        />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={form.control} name="phone" label="Telefono" placeholder="310 000 0000" />
          <TextField control={form.control} name="whatsapp" label="WhatsApp" placeholder="310 000 0000" />
        </div>
        <TextAreaField
          control={form.control}
          name="description"
          label="Descripcion"
          rows={3}
          maxLength={500}
          placeholder={
            form.kind === 'EMERGENCY' ? 'Atiende 24 horas' : 'Arreglos de tuberia y calentadores'
          }
        />
        <TextField control={form.control} name="address" label="Direccion (opcional)" maxLength={200} />
        <SwitchField control={form.control} name="is_active" label="Visible para los residentes" />
      </form>
    </FormDrawer>
  )
}
