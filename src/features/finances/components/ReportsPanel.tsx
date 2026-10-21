import { Alert, Button, Card, Drawer, Dropdown, Select, Skeleton, Tag, Upload } from 'antd'
import {
  Eye,
  EyeOff,
  FileText,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import { SelectField, SwitchField, TextAreaField, TextField } from '@/components/forms/fields'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { FinancialReportCategory } from '@/types/database'
import type { ReportView } from '../viewmodels/reports.logic'
import { useReportsViewModel, type ReportsViewModel } from '../viewmodels/useReportsViewModel'
import { BudgetContent, PortfolioContent, StatementLines } from './ReportContent'

function ReportCard({ report, vm }: { report: ReportView; vm: ReportsViewModel }) {
  const menu = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil size={14} />,
      onClick: () => vm.openEdit(report.id),
    },
    report.isDraft
      ? {
          key: 'publish',
          label: 'Publicar',
          icon: <Eye size={14} />,
          onClick: () => vm.publish(report.id),
        }
      : {
          key: 'unpublish',
          label: 'Retirar',
          icon: <EyeOff size={14} />,
          onClick: () => vm.unpublish(report.id),
        },
    {
      key: 'remove',
      label: 'Eliminar',
      danger: true,
      icon: <Trash2 size={14} />,
      onClick: async () => {
        if (await confirmDelete({ title: 'Eliminar reporte' })) vm.remove(report.id)
      },
    },
  ]
  return (
    <Card
      size="small"
      hoverable
      className="surface-card h-full"
      styles={{ body: { padding: 14 } }}
      onClick={() => vm.openReport(report.id)}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
          <FileText size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-slate-900">{report.title}</p>
          <p className="m-0 text-xs capitalize text-slate-500">
            {report.typeLabel}
            {report.periodLabel ? ` · ${report.periodLabel}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {vm.canManage ? (
              <Tag color={report.isDraft ? 'default' : 'green'} bordered={false} className="!m-0">
                {report.statusLabel}
              </Tag>
            ) : null}
            <span className="text-xs text-slate-400">{report.publishedLabel}</span>
            {report.hasFile ? (
              <Paperclip size={12} className="text-slate-400" aria-label="Con archivo adjunto" />
            ) : null}
          </div>
        </div>
        {vm.canManage ? (
          <span onClick={(event) => event.stopPropagation()}>
            <Dropdown menu={{ items: menu }} trigger={['click']}>
              <Button
                type="text"
                size="small"
                icon={<MoreVertical size={16} />}
                aria-label={`Opciones de ${report.title}`}
              />
            </Dropdown>
          </span>
        ) : null}
      </div>
    </Card>
  )
}

function ReportViewer({ vm }: { vm: ReportsViewModel }) {
  const isMobile = useIsMobile()
  const report = vm.viewing
  const content = vm.content
  return (
    <Drawer
      open={Boolean(report)}
      onClose={vm.closeReport}
      width={isMobile ? '100%' : 720}
      title={
        report ? (
          <div>
            <p className="m-0 font-semibold text-slate-800">{report.title}</p>
            <p className="m-0 text-xs capitalize text-slate-500">
              {report.categoryLabel} · {report.typeLabel}
              {report.periodLabel ? ` · ${report.periodLabel}` : ''}
            </p>
          </div>
        ) : null
      }
      destroyOnClose
    >
      {report ? (
        <div className="space-y-4">
          {report.summary ? (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="m-0 text-xs font-semibold text-slate-500">Notas del contador</p>
              <p className="m-0 mt-1 whitespace-pre-line text-sm text-slate-700">
                {report.summary}
              </p>
            </div>
          ) : null}
          {content?.kind === 'statement' ? <StatementLines lines={content.lines} /> : null}
          {content?.kind === 'budget' ? <BudgetContent budget={content.budget} /> : null}
          {content?.kind === 'portfolio' ? (
            <PortfolioContent portfolio={content.portfolio} />
          ) : null}
          {report.filePath ? (
            <Button
              type={content?.kind === 'document' ? 'primary' : 'default'}
              icon={<Paperclip size={16} />}
              loading={vm.openingFile}
              onClick={() => report.filePath && vm.openFile(report.filePath)}
            >
              {content?.kind === 'document' ? 'Abrir el informe' : 'Ver soporte adjunto'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  )
}

function ReportEditor({ vm }: { vm: ReportsViewModel }) {
  const needsPeriod = vm.reportType === 'BALANCE' || vm.reportType === 'RESULTS'
  return (
    <FormDrawer
      open={vm.editorOpen}
      title={vm.isEditing ? 'Editar reporte' : 'Nuevo reporte'}
      description="Configura lo que veran los propietarios. Puedes guardarlo como borrador y publicarlo despues."
      onClose={vm.closeEditor}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      submitLabel="Guardar"
      width={560}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <SelectField
          control={vm.control}
          name="report_type"
          label="Tipo de reporte"
          required
          showSearch={false}
          options={vm.typeOptions}
          help={vm.typeHint}
          onChangeExtra={vm.onTypeChange}
        />
        {vm.noDataHint ? (
          <Alert type="info" showIcon message={vm.noDataHint} className="!mb-4" />
        ) : null}
        {needsPeriod ? (
          <SelectField
            control={vm.control}
            name="period"
            label="Mes"
            required
            options={vm.periodOptions}
          />
        ) : null}
        {vm.reportType === 'BUDGET' ? (
          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-slate-700">Ano</span>
            <Select
              className="w-full"
              value={vm.yearValue === null ? undefined : String(vm.yearValue)}
              onChange={vm.setYear}
              options={vm.yearOptions}
              placeholder="Elige el ano"
            />
          </label>
        ) : null}
        <TextField
          control={vm.control}
          name="title"
          label="Titulo"
          required
          placeholder="Ej: Estados financieros de septiembre"
        />
        <SelectField
          control={vm.control}
          name="category"
          label="Categoria"
          required
          showSearch={false}
          options={vm.categoryFormOptions}
        />
        <TextAreaField
          control={vm.control}
          name="summary"
          label="Notas para los propietarios"
          rows={4}
          maxLength={4000}
          placeholder="Ej: El mes cerro con superavit; la cartera bajo 8% frente a agosto."
        />
        <div className="mb-4">
          <span className="mb-1 block text-sm text-slate-700">
            {vm.reportType === 'DOCUMENT' ? 'Informe en PDF' : 'Soporte adjunto (opcional)'}
          </span>
          <Upload
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
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
            <p className="m-0 mt-1 text-xs text-slate-500">Ya tiene un archivo adjunto</p>
          ) : null}
          {vm.fileError ? <p className="m-0 mt-1 text-xs text-red-600">{vm.fileError}</p> : null}
        </div>
        <SwitchField
          control={vm.control}
          name="publish"
          label="Publicar para los propietarios"
          checkedLabel="Publicado"
          uncheckedLabel="Borrador"
        />
      </form>
    </FormDrawer>
  )
}

/** Pestana "Reportes": lo que ven los propietarios y lo que publica el contador. */
export function ReportsPanel({ canManage }: { canManage: boolean }) {
  const vm = useReportsViewModel(canManage)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          className="w-full sm:w-72"
          value={vm.category}
          onChange={(value: FinancialReportCategory | 'ALL') => vm.setCategory(value)}
          options={vm.categoryOptions}
          aria-label="Categoria"
        />
        {vm.canManage ? (
          <Button type="primary" icon={<Plus size={16} />} onClick={vm.openNew}>
            Nuevo reporte
          </Button>
        ) : null}
      </div>

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Aun no hay reportes"
          description={
            vm.canManage
              ? 'Crea el primero: elige el tipo (estados financieros, presupuesto, cartera o un PDF) y publicalo.'
              : 'Cuando el contador publique los informes del conjunto, los veras aqui.'
          }
          action={
            vm.canManage ? (
              <Button type="primary" onClick={vm.openNew}>
                Nuevo reporte
              </Button>
            ) : null
          }
        />
      ) : (
        vm.groups.map((group) => (
          <section key={group.key}>
            <h3 className="m-0 text-sm font-semibold text-slate-700">{group.label}</h3>
            <p className="m-0 mb-2 text-xs text-slate-500">{group.description}</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.reports.map((report) => (
                <ReportCard key={report.id} report={report} vm={vm} />
              ))}
            </div>
          </section>
        ))
      )}

      <ReportViewer vm={vm} />
      {vm.canManage ? <ReportEditor vm={vm} /> : null}
    </div>
  )
}
