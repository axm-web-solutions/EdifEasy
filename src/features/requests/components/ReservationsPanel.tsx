import { Button, Card, Input, Modal, Segmented, Skeleton, Tag } from 'antd'
import { Ban, CalendarClock, Check, CreditCard, Plus, Settings2, Wallet, X } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  useReservationsViewModel,
  type ReservationsViewModel,
} from '../viewmodels/useReservationsViewModel'
import { useCommonAreasViewModel } from '../viewmodels/useCommonAreasViewModel'
import type { ReservationView } from '../viewmodels/reservations.logic'
import { ReservationFormDrawer } from './ReservationFormDrawer'
import { CommonAreasDrawer } from './CommonAreasDrawer'

/** Pide una nota opcional y ejecuta la accion. */
function askNote(
  title: string,
  okText: string,
  danger: boolean,
  onOk: (note: string | null) => void,
) {
  let note = ''
  Modal.confirm({
    title,
    okText,
    cancelText: 'Volver',
    okButtonProps: { danger },
    content: (
      <Input.TextArea
        rows={3}
        maxLength={500}
        placeholder="Nota para el residente (opcional)"
        onChange={(event) => (note = event.target.value)}
      />
    ),
    onOk: () => onOk(note.trim() || null),
  })
}

function ReservationCard({ item, vm }: { item: ReservationView; vm: ReservationsViewModel }) {
  return (
    <Card size="small" className="surface-card" styles={{ body: { padding: 14 } }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
            <CalendarClock size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{item.areaName}</span>
              <Tag color={item.statusColor} bordered={false} className="!m-0">
                {item.statusLabel}
              </Tag>
            </div>
            <div className="text-sm capitalize text-slate-700">
              {item.dateLabel} · {item.timeLabel}
            </div>
            <div className="text-xs text-slate-500">
              {item.unitLabel}
              {item.authorName ? ` · ${item.authorName}` : ''} · {item.amountLabel}
              {item.paymentLabel ? ` · ${item.paymentLabel}` : ''}
            </div>
            {item.notes ? <p className="m-0 mt-1 text-xs text-slate-600">“{item.notes}”</p> : null}
            {item.adminNotes ? (
              <p className="m-0 mt-1 text-xs text-slate-600">
                <strong>Administracion:</strong> {item.adminNotes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {item.canReview ? (
            <>
              <Button
                size="small"
                type="primary"
                icon={<Check size={14} />}
                onClick={() =>
                  askNote('Aprobar reserva', 'Aprobar', false, (note) => vm.approve(item.id, note))
                }
              >
                Aprobar
              </Button>
              <Button
                size="small"
                danger
                icon={<X size={14} />}
                onClick={() =>
                  askNote('Rechazar reserva', 'Rechazar', true, (note) => vm.reject(item.id, note))
                }
              >
                Rechazar
              </Button>
            </>
          ) : null}
          {item.canPayOnline ? (
            <Button
              size="small"
              type="primary"
              icon={<CreditCard size={14} />}
              loading={vm.paying === item.id}
              onClick={() => vm.payOnline(item.id)}
            >
              Pagar en linea
            </Button>
          ) : null}
          {item.canRegisterPayment ? (
            <Button
              size="small"
              icon={<Wallet size={14} />}
              onClick={() =>
                Modal.confirm({
                  title: 'Registrar pago',
                  content: `Confirma que recibiste ${item.amountLabel} en la administracion (efectivo o transferencia).`,
                  okText: 'Registrar',
                  cancelText: 'Volver',
                  onOk: () => vm.registerPayment(item.id),
                })
              }
            >
              Pago recibido
            </Button>
          ) : null}
          {item.canCancel ? (
            <Button
              size="small"
              icon={<Ban size={14} />}
              onClick={() =>
                askNote('Cancelar reserva', 'Cancelar reserva', true, (note) =>
                  vm.cancel(item.id, note),
                )
              }
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/** Pestana "Reservas" de Solicitudes. */
export function ReservationsPanel() {
  const vm = useReservationsViewModel()
  const areas = useCommonAreasViewModel()

  return (
    <div data-tour="reservations">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented
          value={vm.filter}
          onChange={(value) => vm.setFilter(value as typeof vm.filter)}
          options={vm.filterOptions}
        />
        <div className="flex flex-wrap gap-2">
          {areas.canManage ? (
            <Button icon={<Settings2 size={16} />} onClick={areas.show}>
              Zonas comunes
            </Button>
          ) : null}
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={vm.openForm}
            disabled={!vm.canReserve}
          >
            Nueva reserva
          </Button>
        </div>
      </div>

      {vm.noApartmentHint ? (
        <p className="mb-3 mt-0 text-xs text-slate-500">
          Para reservar necesitas tener un apartamento asignado.
        </p>
      ) : null}

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : vm.status === 'error' ? (
        <ErrorState description="No se pudieron cargar las reservas." onRetry={vm.retry} />
      ) : vm.status === 'no-areas' ? (
        <EmptyState
          title="Aun no hay zonas comunes para reservar"
          description={
            vm.isAdmin
              ? 'Crea el salon social, la zona BBQ o la cancha con su valor y horario.'
              : 'La administracion aun no ha habilitado zonas comunes.'
          }
          action={
            areas.canManage ? (
              <Button type="primary" icon={<Plus size={16} />} onClick={areas.show}>
                Configurar zonas comunes
              </Button>
            ) : undefined
          }
        />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Sin reservas aqui"
          description={
            vm.filter === 'pending'
              ? 'No hay reservas por aprobar ni por pagar.'
              : 'No hay reservas en esta vista.'
          }
        />
      ) : (
        <div className="space-y-3">
          {vm.reservations.map((item) => (
            <ReservationCard key={item.id} item={item} vm={vm} />
          ))}
        </div>
      )}

      <ReservationFormDrawer vm={vm} />
      {areas.canManage ? <CommonAreasDrawer vm={areas} /> : null}
    </div>
  )
}
