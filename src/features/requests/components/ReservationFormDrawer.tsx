import { Alert, Tag } from 'antd'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { DateField, NumberField, SelectField, TextAreaField } from '@/components/forms/fields'
import type { ReservationsViewModel } from '../viewmodels/useReservationsViewModel'

/** Formulario de nueva reserva: zona, fecha, horario y opcion de pago. */
export function ReservationFormDrawer({ vm }: { vm: ReservationsViewModel }) {
  const times = vm.timeOptions.map((time) => ({ value: time, label: time }))

  return (
    <FormDrawer
      open={vm.formOpen}
      title="Nueva reserva"
      description="Reserva una zona comun para una fecha y horario."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      submitLabel="Reservar"
      width={520}
    >
      <form onSubmit={vm.submit} noValidate>
        <SelectField
          control={vm.control}
          name="common_area_id"
          label="Zona comun"
          required
          options={vm.areaOptions}
        />

        {vm.area ? (
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <p className="m-0">
              Horario {vm.area.hours} · maximo {vm.area.maxHours} h
              {vm.area.capacity ? ` · aforo ${vm.area.capacity} personas` : ''}
            </p>
            <p className="m-0 mt-1 font-medium">{vm.area.flowNote}</p>
            {vm.area.description ? (
              <p className="m-0 mt-1 text-slate-500">{vm.area.description}</p>
            ) : null}
            {vm.area.rules ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-medium text-brand-text">
                  Reglas de uso
                </summary>
                <p className="m-0 mt-1 whitespace-pre-line text-xs text-slate-600">
                  {vm.area.rules}
                </p>
              </details>
            ) : null}
          </div>
        ) : null}

        {vm.showApartment ? (
          <SelectField
            control={vm.control}
            name="apartment_id"
            label="Apartamento"
            required
            options={vm.apartmentOptions}
          />
        ) : null}

        <DateField control={vm.control} name="day" label="Fecha" required />

        {vm.busyLabels.length > 0 ? (
          <div className="-mt-2 mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            Ocupado ese dia:
            {vm.busyLabels.map((label) => (
              <Tag key={label} color="red" bordered={false} className="!m-0">
                {label}
              </Tag>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4">
          <SelectField
            control={vm.control}
            name="start"
            label="Desde"
            required
            options={times}
            disabled={!vm.area}
          />
          <SelectField
            control={vm.control}
            name="end"
            label="Hasta"
            required
            options={times}
            disabled={!vm.area}
          />
        </div>

        <NumberField
          control={vm.control}
          name="guests"
          label="Invitados (aprox.)"
          min={0}
          max={5000}
        />
        <TextAreaField
          control={vm.control}
          name="notes"
          label="Comentarios"
          rows={3}
          maxLength={500}
        />

        {vm.slotError ? (
          <Alert type="warning" showIcon message={vm.slotError} className="mb-3" />
        ) : null}
        {vm.submitError ? <Alert type="error" showIcon message={vm.submitError} /> : null}
      </form>
    </FormDrawer>
  )
}
