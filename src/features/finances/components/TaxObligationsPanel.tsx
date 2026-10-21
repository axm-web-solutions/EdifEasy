import { Alert, Button, Card, Dropdown, Segmented, Skeleton, Tag, Upload } from 'antd'
import {
  CalendarClock,
  Check,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import type { ObligationFilter } from '../viewmodels/useTaxObligationsViewModel'
import {
  useTaxObligationsViewModel,
  type TaxObligationsViewModel,
} from '../viewmodels/useTaxObligationsViewModel'
import { Kpi } from './ReportContent'

function ObligationForm({ vm }: { vm: TaxObligationsViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title={vm.isEditing ? 'Editar obligacion' : 'Nueva obligacion fiscal'}
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <TextField control={vm.control} name="name" label="Obligacion" required />
        <SelectField
          control={vm.control}
          name="authority"
          label="Entidad"
          required
          showSearch={false}
          options={vm.authorityOptions}
        />
        <TextField
          control={vm.control}
          name="period_label"
          label="Periodo"
          placeholder="Ej: Octubre 2026, Bimestre 5, Ano gravable 2025"
        />
        <DateField control={vm.control} name="due_date" label="Vence" required />
        <SelectField
          control={vm.control}
          name="status"
          label="Estado"
          required
          showSearch={false}
          options={vm.statusOptions}
        />
        <NumberField control={vm.control} name="amount" label="Valor pagado" />
        <TextField control={vm.control} name="reference" label="Numero de formulario o radicado" />
        <TextAreaField control={vm.control} name="notes" label="Notas" rows={3} maxLength={1000} />
        <div className="mb-2">
          <span className="mb-1 block text-sm text-slate-700">
            Soporte (declaracion, recibo de pago)
          </span>
          <Upload
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              vm.setFile(file)
              return false
            }}
          >
            <Button icon={<UploadCloud size={16} />}>
              {vm.file || vm.existingFile ? 'Cambiar archivo' : 'Elegir archivo'}
            </Button>
          </Upload>
          {vm.file ? (
            <p className="m-0 mt-1 text-xs text-slate-600">{vm.file.name}</p>
          ) : vm.existingFile ? (
            <p className="m-0 mt-1 text-xs text-slate-500">Ya tiene soporte</p>
          ) : null}
        </div>
      </form>
    </FormDrawer>
  )
}

/** Pestana "Obligaciones fiscales". */
export function TaxObligationsPanel({ canManage }: { canManage: boolean }) {
  const vm = useTaxObligationsViewModel(canManage)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Pendientes" value={String(vm.summary.pending)} />
        <Kpi
          label="Vencidas"
          value={String(vm.summary.overdue)}
          tone={vm.summary.overdue ? 'danger' : 'ok'}
        />
        <Kpi label="Proximo vencimiento" value={vm.summary.next ?? 'Ninguno'} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={vm.filter}
          onChange={(value) => vm.setFilter(value as ObligationFilter)}
          options={vm.filterOptions}
        />
        {vm.canManage ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'blank', label: 'En blanco', onClick: () => vm.openNew() },
                { type: 'divider' },
                ...vm.presets.map((name) => ({
                  key: name,
                  label: name,
                  onClick: () => vm.openNew(name),
                })),
              ],
            }}
          >
            <Button type="primary" icon={<Plus size={16} />}>
              Nueva obligacion
            </Button>
          </Dropdown>
        ) : null}
      </div>

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.obligations.length === 0 ? (
        <EmptyState
          title={vm.filter === 'pending' ? 'No hay obligaciones pendientes' : 'Sin obligaciones'}
          description={
            vm.canManage
              ? 'Registra las declaraciones y pagos con su fecha de vencimiento.'
              : undefined
          }
        />
      ) : (
        <Card className="surface-card" styles={{ body: { padding: 0 } }}>
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.obligations.map((item) => (
              <li
                key={item.id}
                className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${item.urgency === 'overdue' ? 'bg-red-50/60' : ''}`}
              >
                <CalendarClock
                  size={18}
                  className="hidden shrink-0 text-slate-400 sm:block"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                    <Tag color={item.statusColor} bordered={false} className="!m-0">
                      {item.statusLabel}
                    </Tag>
                  </div>
                  <p className="m-0 text-xs text-slate-500">
                    {item.authorityLabel}
                    {item.periodLabel ? ` · ${item.periodLabel}` : ''} · vence {item.dueLabel} ·{' '}
                    {item.dueHint}
                  </p>
                  {item.amount || item.reference ? (
                    <p className="m-0 text-xs text-slate-500">
                      {item.amount ?? ''}
                      {item.amount && item.reference ? ' · ' : ''}
                      {item.reference ? `Ref. ${item.reference}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.filePath ? (
                    <Button
                      size="small"
                      icon={<Paperclip size={14} />}
                      onClick={() => item.filePath && vm.openFile(item.filePath)}
                    >
                      Soporte
                    </Button>
                  ) : null}
                  {vm.canManage && item.isPending ? (
                    <>
                      <Button
                        size="small"
                        icon={<Send size={14} />}
                        onClick={() => vm.markFiled(item.id)}
                      >
                        Presentada
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<Check size={14} />}
                        onClick={() => vm.markPaid(item.id)}
                      >
                        Pagada
                      </Button>
                    </>
                  ) : null}
                  {vm.canManage ? (
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
                              if (await confirmDelete({ title: 'Eliminar obligacion' }))
                                vm.remove(item.id)
                            },
                          },
                        ],
                      }}
                    >
                      <Button
                        size="small"
                        type="text"
                        icon={<MoreVertical size={16} />}
                        aria-label={`Opciones de ${item.name}`}
                      />
                    </Dropdown>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {vm.canManage ? <ObligationForm vm={vm} /> : null}
    </div>
  )
}
