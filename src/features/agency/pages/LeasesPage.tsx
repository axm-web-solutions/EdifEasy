import { Alert, Button, Card, Modal, Skeleton, Tag } from 'antd'
import { FileSignature, Pencil, Plus, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { useLeasesViewModel, type LeasesViewModel } from '../viewmodels/useLeasesViewModel'

type LeaseView = LeasesViewModel['active'][number]

function LeaseCard({ lease, vm }: { lease: LeaseView; vm: LeasesViewModel }) {
  return (
    <Card size="small" className="surface-card" styles={{ body: { padding: 14 } }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
          <FileSignature size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{lease.property}</span>
            <Tag color={lease.statusColor} bordered={false} className="!m-0">
              {lease.statusLabel}
            </Tag>
          </div>
          <p className="m-0 text-xs text-slate-500">{lease.location}</p>
          <p className="m-0 mt-1 flex items-center gap-1 text-sm text-slate-700">
            {lease.tenant}
            {lease.hasAccount ? (
              <UserCheck size={14} className="text-emerald-600" aria-label="Con cuenta en la app" />
            ) : null}
          </p>
          {lease.contact ? <p className="m-0 text-xs text-slate-500">{lease.contact}</p> : null}
          <p className="m-0 mt-1 text-xs text-slate-600">
            {lease.rent} / mes{lease.adminFee ? ` + administracion ${lease.adminFee}` : ''} ·{' '}
            {lease.dueDay}
          </p>
          <p className="m-0 text-xs text-slate-500">{lease.period}</p>
        </div>
        <div className="flex gap-2">
          <Button size="small" icon={<Pencil size={14} />} onClick={() => vm.openEdit(lease.id)}>
            Editar
          </Button>
          {lease.active ? (
            <Button
              size="small"
              onClick={() =>
                Modal.confirm({
                  title: 'Terminar contrato',
                  content:
                    'El contrato termina hoy, ya no se generan cobros y la propiedad vuelve a estar disponible.',
                  okText: 'Terminar',
                  okButtonProps: { danger: true },
                  cancelText: 'Volver',
                  onOk: () => vm.endLease(lease.id),
                })
              }
            >
              Terminar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function LeaseForm({ vm }: { vm: LeasesViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title={vm.isEditing ? 'Editar contrato' : 'Nuevo contrato de arriendo'}
      description="Con el contrato vigente, cada mes se generan el canon y la administracion para pagar en la app."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      width={600}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <SelectField
          control={vm.control}
          name="property_id"
          label="Propiedad"
          required
          disabled={vm.isEditing}
          options={vm.propertyOptions}
          onChangeExtra={vm.onPropertyChange}
        />
        <SelectField
          control={vm.control}
          name="tenant_profile_id"
          label="Arrendatario con cuenta"
          allowClear
          options={vm.tenantOptions}
          onChangeExtra={vm.onTenantChange}
          help="Para que pague en linea. Invitalo en Usuarios con el rol Arrendatario."
        />
        <TextField
          control={vm.control}
          name="tenant_name"
          label="Nombre del arrendatario"
          required
        />
        <div className="grid gap-x-4 sm:grid-cols-3">
          <TextField control={vm.control} name="tenant_document" label="Documento" />
          <TextField control={vm.control} name="tenant_phone" label="Telefono" />
          <TextField control={vm.control} name="tenant_email" label="Correo" />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <DateField control={vm.control} name="start_date" label="Inicio" required />
          <DateField control={vm.control} name="end_date" label="Fin (opcional)" />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <NumberField
            control={vm.control}
            name="monthly_rent"
            label="Canon mensual"
            required
            min={0}
            addonBefore="$"
          />
          <NumberField
            control={vm.control}
            name="admin_fee"
            label="Administracion mensual"
            min={0}
            addonBefore="$"
          />
          <NumberField
            control={vm.control}
            name="due_day"
            label="Dia de pago"
            required
            min={1}
            max={28}
          />
          <NumberField
            control={vm.control}
            name="deposit"
            label="Deposito"
            min={0}
            addonBefore="$"
          />
        </div>
        <TextAreaField control={vm.control} name="notes" label="Notas" rows={3} maxLength={1000} />
      </form>
    </FormDrawer>
  )
}

export function LeasesPage() {
  const vm = useLeasesViewModel()
  return (
    <div>
      <PageHeader
        title="Contratos de arriendo"
        subtitle="Quien arrienda cada propiedad, cuanto paga y que dia."
        dataTour="agency-leases"
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={vm.openNew}>
            Nuevo contrato
          </Button>
        }
      />
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Aun no hay contratos"
          description="Crea el contrato cuando arriendes una propiedad: la app genera los cobros cada mes."
          action={
            <Button type="primary" onClick={vm.openNew}>
              Nuevo contrato
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="m-0 text-sm font-semibold text-slate-600">
              Vigentes ({vm.active.length})
            </h3>
            {vm.active.map((lease) => (
              <LeaseCard key={lease.id} lease={lease} vm={vm} />
            ))}
          </section>
          {vm.past.length ? (
            <section className="space-y-3">
              <h3 className="m-0 text-sm font-semibold text-slate-600">
                Terminados ({vm.past.length})
              </h3>
              {vm.past.map((lease) => (
                <LeaseCard key={lease.id} lease={lease} vm={vm} />
              ))}
            </section>
          ) : null}
        </div>
      )}
      <LeaseForm vm={vm} />
    </div>
  )
}
