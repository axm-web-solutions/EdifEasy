import { Button, Drawer, List, Tag } from 'antd'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import { EmptyState } from '@/components/ui/states'
import {
  NumberField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import type { CommonAreasViewModel } from '../viewmodels/useCommonAreasViewModel'

const HOURS = Array.from({ length: 48 }, (_, index) => {
  const value = `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`
  return { value, label: value }
})

/** Lista y formulario de zonas comunes (administracion). */
export function CommonAreasDrawer({ vm }: { vm: CommonAreasViewModel }) {
  return (
    <>
      <Drawer
        open={vm.open}
        onClose={vm.hide}
        width={520}
        title="Zonas comunes"
        extra={
          <Button type="primary" icon={<Plus size={14} />} onClick={vm.openNew}>
            Nueva zona
          </Button>
        }
      >
        {vm.areas.length === 0 && !vm.loading ? (
          <EmptyState
            title="Sin zonas comunes"
            description="Crea el salon social, la zona BBQ, la cancha... con su valor y horario."
          />
        ) : (
          <List
            loading={vm.loading}
            dataSource={vm.areas}
            renderItem={(area) => (
              <List.Item
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    aria-label={`Editar ${area.name}`}
                    icon={<Pencil size={14} />}
                    onClick={() => vm.openEdit(area.row)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span className="flex items-center gap-2">
                      {area.name}
                      {!area.active ? <Tag className="!m-0">Inactiva</Tag> : null}
                    </span>
                  }
                  description={<span className="text-xs">{area.detail}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      <FormDrawer
        open={vm.formOpen}
        title={vm.formTitle}
        description="Horario en hora de Colombia. El valor se cobra por reserva."
        onClose={vm.closeForm}
        onSubmit={vm.submit}
        submitting={vm.submitting}
        width={520}
        footerExtra={
          vm.editingId ? (
            <Button
              danger
              icon={<Trash2 size={14} />}
              onClick={async () => {
                const ok = await confirmDelete({
                  title: 'Eliminar zona comun',
                  content: 'Solo se puede eliminar si no tiene reservas. Si ya tiene, desactivala.',
                })
                if (ok) vm.removeEditing()
              }}
            >
              Eliminar
            </Button>
          ) : null
        }
      >
        <form onSubmit={vm.submit} noValidate>
          <TextField
            control={vm.control}
            name="name"
            label="Nombre"
            required
            maxLength={80}
            placeholder="Salon social"
          />
          <div className="grid grid-cols-2 gap-x-4">
            <NumberField
              control={vm.control}
              name="price"
              label="Valor por reserva (COP)"
              min={0}
            />
            <NumberField control={vm.control} name="capacity" label="Aforo (personas)" min={1} />
            <SelectField
              control={vm.control}
              name="open_time"
              label="Abre"
              required
              options={HOURS}
            />
            <SelectField
              control={vm.control}
              name="close_time"
              label="Cierra"
              required
              options={HOURS}
            />
            <NumberField
              control={vm.control}
              name="max_hours"
              label="Horas maximas"
              required
              min={1}
              max={24}
            />
          </div>
          <TextAreaField
            control={vm.control}
            name="description"
            label="Descripcion"
            rows={2}
            maxLength={500}
          />
          <TextAreaField
            control={vm.control}
            name="rules"
            label="Reglas de uso"
            rows={4}
            maxLength={2000}
          />
          <SwitchField
            control={vm.control}
            name="requires_approval"
            label="Requiere aprobacion de la administracion"
          />
          <SwitchField control={vm.control} name="is_active" label="Disponible para reservar" />
        </form>
      </FormDrawer>
    </>
  )
}
