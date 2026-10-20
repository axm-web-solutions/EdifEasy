import { Alert, Button, Card, Input, Segmented, Select, Skeleton, Switch, Tag } from 'antd'
import { NotebookPen, Plus, Search, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { SelectField, TextAreaField } from '@/components/forms/fields'
import type { GuardLogCategory } from '@/types/database'
import type { LogbookPeriod } from '../viewmodels/logbook.logic'
import { useLogbookViewModel, type LogbookViewModel } from '../viewmodels/useLogbookViewModel'

function EntryFormDrawer({ vm }: { vm: LogbookViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title="Nueva anotacion"
      description="Queda con tu nombre, fecha y hora. No se puede editar despues."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      submitLabel="Registrar"
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <SelectField
          control={vm.control}
          name="category"
          label="Tipo"
          required
          showSearch={false}
          options={vm.categoryOptions}
        />
        <SelectField
          control={vm.control}
          name="priority"
          label="Prioridad"
          required
          showSearch={false}
          options={vm.priorityOptions}
          help="Las urgentes le llegan de inmediato a la administracion."
        />
        <TextAreaField
          control={vm.control}
          name="description"
          label="Que paso"
          required
          rows={5}
          maxLength={2000}
          placeholder="Ej: Llega domicilio para la Torre 2 · 301, se entrega al residente."
        />
        <SelectField
          control={vm.control}
          name="apartment_id"
          label="Apartamento relacionado"
          allowClear
          options={vm.apartmentOptions}
          placeholder="Opcional"
        />
      </form>
    </FormDrawer>
  )
}

export function LogbookPage() {
  const vm = useLogbookViewModel()

  return (
    <div>
      <PageHeader
        title="Minuta de porteria"
        subtitle="Lo que pasa en cada turno, con hora y responsable."
        dataTour="logbook-header"
        actions={
          vm.canWrite ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => vm.openForm()}>
              Nueva anotacion
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card size="small" className="surface-card">
          <p className="m-0 text-xs text-slate-500">Turno</p>
          <p className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShieldCheck
              size={16}
              className={vm.summary.shiftOpen ? 'text-emerald-600' : 'text-slate-400'}
            />
            {vm.summary.shiftLabel}
          </p>
        </Card>
        <Card size="small" className="surface-card">
          <p className="m-0 text-xs text-slate-500">Anotaciones en el periodo</p>
          <p className="m-0 text-lg font-semibold text-slate-800">{vm.summary.total}</p>
        </Card>
        <Card size="small" className="surface-card">
          <p className="m-0 text-xs text-slate-500">Urgentes</p>
          <p className="m-0 text-lg font-semibold text-slate-800">{vm.summary.urgent}</p>
        </Card>
      </div>

      {vm.canWrite ? (
        <div className="mb-4 flex flex-wrap gap-2" data-tour="logbook-quick">
          {vm.quickActions.map((action) => (
            <Button
              key={action.category}
              size="small"
              shape="round"
              onClick={() => vm.openForm(action.category)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      <Card size="small" className="surface-card !mb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Segmented
            value={vm.period}
            onChange={(value) => vm.setPeriod(value as LogbookPeriod)}
            options={vm.periodOptions}
          />
          <Select
            className="w-full lg:w-52"
            value={vm.filters.category}
            onChange={(value: GuardLogCategory | 'ALL') => vm.setCategory(value)}
            options={vm.categoryFilterOptions}
            aria-label="Tipo de anotacion"
          />
          <Input
            allowClear
            className="lg:max-w-xs"
            prefix={<Search size={14} className="text-slate-400" />}
            placeholder="Buscar en la minuta"
            value={vm.filters.search}
            onChange={(event) => vm.setSearch(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Switch
              size="small"
              checked={vm.filters.onlyImportant}
              onChange={vm.setOnlyImportant}
            />
            Solo importantes
          </label>
        </div>
      </Card>

      {vm.status === 'loading' ? (
        <Card className="surface-card">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title={vm.filtered ? 'Nada coincide con los filtros' : 'La minuta esta al dia'}
          description={
            vm.filtered
              ? 'Prueba con otro tipo o quita la busqueda.'
              : vm.canWrite
                ? 'Empieza el turno con una anotacion de inicio.'
                : 'Aun no hay anotaciones en este periodo.'
          }
          action={
            vm.filtered ? (
              <Button onClick={vm.clearFilters}>Quitar filtros</Button>
            ) : vm.canWrite ? (
              <Button type="primary" onClick={() => vm.openForm('TURNO_INICIO')}>
                Iniciar turno
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-5">
          {vm.groups.map((group) => (
            <section key={group.key}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-slate-600">
                {group.label}
              </h3>
              <Card className="surface-card" styles={{ body: { padding: 0 } }}>
                <ol className="m-0 list-none divide-y divide-slate-100 p-0">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className={`flex gap-3 px-4 py-3 ${
                        entry.priority === 'URGENTE' ? 'bg-orange-50/60' : ''
                      }`}
                    >
                      <span className="w-12 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-slate-500">
                        {entry.timeLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {entry.categoryLabel}
                          </span>
                          {entry.highlighted ? (
                            <Tag color={entry.priorityColor} bordered={false} className="!m-0">
                              {entry.priorityLabel}
                            </Tag>
                          ) : null}
                          {entry.unitLabel ? (
                            <Tag bordered={false} className="!m-0">
                              {entry.unitLabel}
                            </Tag>
                          ) : null}
                        </div>
                        <p className="m-0 mt-0.5 whitespace-pre-line break-words text-sm text-slate-700">
                          {entry.description}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-slate-400">{entry.authorName}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          ))}
        </div>
      )}

      {vm.canWrite ? (
        <Button
          type="primary"
          shape="circle"
          size="large"
          aria-label="Nueva anotacion"
          icon={<NotebookPen size={20} />}
          className="!fixed bottom-5 right-5 z-20 shadow-lg md:!hidden"
          onClick={() => vm.openForm()}
        />
      ) : null}

      <EntryFormDrawer vm={vm} />
    </div>
  )
}
