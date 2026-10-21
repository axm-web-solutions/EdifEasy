import {
  Alert,
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Tag,
  Typography,
} from 'antd'
import {
  BellRing,
  CheckCircle2,
  Copy,
  KeyRound,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Radio,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import { SelectField, SwitchField, TextAreaField, TextField } from '@/components/forms/fields'
import type { DeviceView, EventFilter, EventView } from '../viewmodels/alarms.logic'
import { useAlarmsViewModel, type AlarmsViewModel } from '../viewmodels/useAlarmsViewModel'

const { Paragraph } = Typography

function askNote(onOk: (note: string | null) => void) {
  let note = ''
  Modal.confirm({
    title: 'Marcar como atendido',
    okText: 'Atendido',
    cancelText: 'Volver',
    content: (
      <Input.TextArea
        rows={3}
        maxLength={500}
        placeholder="Que se hizo (opcional): ej. falsa alarma, se verifico con el residente"
        onChange={(event) => (note = event.target.value)}
      />
    ),
    onOk: () => onOk(note.trim() || null),
  })
}

function DeviceCard({ device, vm }: { device: DeviceView; vm: AlarmsViewModel }) {
  const menu = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil size={14} />,
      onClick: () => vm.openEdit(device.id),
    },
    {
      key: 'rotate',
      label: 'Generar nueva URL',
      icon: <KeyRound size={14} />,
      onClick: () =>
        Modal.confirm({
          title: 'Generar una nueva URL',
          content:
            'La URL anterior deja de funcionar. Tendras que configurar la nueva en el panel o la central.',
          okText: 'Generar',
          cancelText: 'Volver',
          onOk: () => vm.rotate(device.id),
        }),
    },
    {
      key: 'toggle',
      label: device.isActive ? 'Desactivar' : 'Activar',
      icon: <Power size={14} />,
      onClick: () => vm.toggleActive(device.id),
    },
    {
      key: 'remove',
      label: 'Desconectar',
      danger: true,
      icon: <Trash2 size={14} />,
      onClick: async () => {
        if (
          await confirmDelete({
            title: 'Desconectar alarma',
            content: 'Se borra la alarma y su historial de eventos.',
            okText: 'Desconectar',
          })
        )
          vm.remove(device.id)
      },
    },
  ]
  return (
    <Card size="small" className="surface-card h-full" styles={{ body: { padding: 14 } }}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
          <ShieldCheck size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{device.name}</span>
            <Tag color={device.stateColor} bordered={false} className="!m-0">
              {device.stateLabel}
            </Tag>
          </div>
          <p className="m-0 text-xs text-slate-600">{device.unitLabel}</p>
          <p className="m-0 text-xs text-slate-500">
            {device.providerLabel} · URL {device.tokenHint}
          </p>
          <p className="m-0 mt-1 text-xs text-slate-500">{device.lastEventLabel}</p>
        </div>
        {device.canManage ? (
          <Dropdown menu={{ items: menu }} trigger={['click']}>
            <Button
              type="text"
              size="small"
              icon={<MoreVertical size={16} />}
              aria-label={`Opciones de ${device.name}`}
            />
          </Dropdown>
        ) : null}
      </div>
      {device.canManage ? (
        <Button
          size="small"
          className="!mt-3"
          icon={<Radio size={14} />}
          loading={vm.busyDevice === device.id}
          onClick={() => vm.test(device.id)}
        >
          Enviar prueba
        </Button>
      ) : null}
    </Card>
  )
}

function EventItem({ event, vm }: { event: EventView; vm: AlarmsViewModel }) {
  return (
    <li
      className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${
        event.needsAttention && (event.severity === 'CRITICAL' || event.severity === 'HIGH')
          ? 'bg-red-50/60'
          : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={event.color} bordered={false} className="!m-0">
            {event.label}
          </Tag>
          <span className="text-sm font-medium text-slate-800">{event.unitLabel}</span>
          {event.acknowledged ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 size={12} /> Atendido
            </span>
          ) : null}
        </div>
        <p className="m-0 mt-0.5 text-xs text-slate-500">
          {event.deviceName}
          {event.detail ? ` · ${event.detail}` : ''} ·{' '}
          <span title={event.whenLabel}>{event.relativeLabel}</span>
        </p>
        {event.resolutionNote ? (
          <p className="m-0 mt-0.5 text-xs text-slate-600">“{event.resolutionNote}”</p>
        ) : null}
      </div>
      {event.canAcknowledge ? (
        <Button size="small" onClick={() => askNote((note) => vm.acknowledge(event.id, note))}>
          Marcar atendido
        </Button>
      ) : null}
    </li>
  )
}

function DeviceFormDrawer({ vm }: { vm: AlarmsViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title={vm.isEditing ? 'Editar alarma' : 'Conectar alarma'}
      description="Funciona con cualquier marca: cada alarma recibe su propia URL segura."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      submitLabel={vm.isEditing ? 'Guardar' : 'Conectar'}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <SelectField
          control={vm.control}
          name="apartment_id"
          label="Casa, apartamento o zona comun"
          required
          disabled={vm.isEditing}
          options={vm.unitOptions}
        />
        <TextField
          control={vm.control}
          name="name"
          label="Nombre"
          required
          placeholder="Ej: Panel principal"
        />
        <SelectField
          control={vm.control}
          name="provider"
          label="Marca o sistema"
          required
          options={vm.providerOptions}
          help={vm.providerSetup}
        />
        <TextField
          control={vm.control}
          name="location"
          label={vm.unitIsCommon ? 'Lugar' : 'Ubicacion (opcional)'}
          placeholder={vm.unitIsCommon ? 'Ej: Porteria, parqueadero' : 'Ej: Segundo piso'}
        />
        <TextAreaField control={vm.control} name="notes" label="Notas" rows={2} maxLength={300} />
        {vm.isEditing ? <SwitchField control={vm.control} name="is_active" label="Activa" /> : null}
      </form>
    </FormDrawer>
  )
}

function CredentialsModal({ vm }: { vm: AlarmsViewModel }) {
  const credentials = vm.credentials
  return (
    <Modal
      open={Boolean(credentials)}
      title={`URL de ${credentials?.deviceName ?? 'la alarma'}`}
      onCancel={vm.closeCredentials}
      footer={
        <Button type="primary" onClick={vm.closeCredentials}>
          Ya la guarde
        </Button>
      }
      width={620}
      destroyOnClose
    >
      {credentials ? (
        <div className="space-y-3">
          <Alert
            type="warning"
            showIcon
            message="Copiala ahora: por seguridad no se vuelve a mostrar."
            description="Si la pierdes, genera una nueva desde el menu de la alarma."
          />
          <Paragraph
            copyable={{ text: credentials.url, icon: <Copy size={14} /> }}
            className="!mb-0 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs"
          >
            {credentials.url}
          </Paragraph>
          <p className="m-0 text-sm text-slate-700">{credentials.setup}</p>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-text">
              Ejemplo para el instalador
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {credentials.example}
            </pre>
          </details>
        </div>
      ) : null}
    </Modal>
  )
}

export function AlarmsPage() {
  const vm = useAlarmsViewModel()

  return (
    <div>
      <PageHeader
        title="Alarmas"
        subtitle="Alarmas conectadas de cada casa o apartamento: cuando se activa una, avisamos al instante."
        dataTour="alarms-header"
        actions={
          vm.canAdd ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={vm.openNew}>
              Conectar alarma
            </Button>
          ) : null
        }
      />

      {vm.status === 'loading' ? (
        <Card className="surface-card">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-600">
              Alarmas conectadas ({vm.activeDevices} activas)
            </h3>
            {vm.devices.length === 0 ? (
              <EmptyState
                title="Aun no hay alarmas conectadas"
                description={
                  vm.canAdd
                    ? 'Conecta la alarma de una casa o apartamento y recibe sus eventos aqui.'
                    : 'Cuando el propietario o la administracion conecten la alarma, la veras aqui.'
                }
                action={
                  vm.canAdd ? (
                    <Button type="primary" onClick={vm.openNew}>
                      Conectar alarma
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {vm.devices.map((device) => (
                  <DeviceCard key={device.id} device={device} vm={vm} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <BellRing size={16} /> Eventos de los ultimos 30 dias
              </h3>
              <div className="max-w-full overflow-x-auto">
                <Segmented
                  value={vm.filter}
                  onChange={(value) => vm.setFilter(value as EventFilter)}
                  options={vm.filterOptions}
                />
              </div>
            </div>
            {vm.events.length === 0 ? (
              <EmptyState
                title="Sin eventos"
                description="Aqui aparecen en vivo las alarmas activadas, fallas y armados."
              />
            ) : (
              <Card className="surface-card" styles={{ body: { padding: 0 } }}>
                <ul className="m-0 list-none divide-y divide-slate-100 p-0">
                  {vm.events.map((event) => (
                    <EventItem key={event.id} event={event} vm={vm} />
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}

      <DeviceFormDrawer vm={vm} />
      <CredentialsModal vm={vm} />
    </div>
  )
}
