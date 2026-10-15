import { Button, Col, Row } from 'antd'
import { CircleDollarSign, Gavel, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatCard } from '@/components/ui/StatCard'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { formatCompactCurrency } from '@/utils/format'
import type { FineWithRelations } from '@/types/models'
import { useFinesViewModel } from '../viewmodels/useFinesViewModel'
import { FINE_EXPORT_COLUMNS, finesColumns } from '../components/finesColumns'

/** Vista de Multas: solo dibuja lo que entrega `useFinesViewModel`. */
export function FinesPage() {
  const vm = useFinesViewModel()
  const { table, stats, form } = vm

  return (
    <>
      <PageHeader
        title="Multas"
        subtitle="Sanciones por incumplimiento del reglamento de propiedad horizontal."
        actions={
          vm.permissions.canManage ? (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={vm.actions.openCreate}
              data-tour="create-button"
            >
              Nueva multa
            </Button>
          ) : null
        }
        dataTour="page-header"
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12}>
          <StatCard
            title="Pendiente por cobrar"
            value={formatCompactCurrency(stats.pendingAmount)}
            icon={<Gavel size={20} />}
            tone="orange"
            loading={stats.loading}
            footer={`${stats.pendingCount} multa(s) pendiente(s)`}
            hint="Total de las multas que cumplen los filtros aplicados"
          />
        </Col>
        <Col xs={24} sm={12}>
          <StatCard
            title="Recaudado"
            value={formatCompactCurrency(stats.paidAmount)}
            icon={<CircleDollarSign size={20} />}
            tone="green"
            loading={stats.loading}
            footer={`${stats.paidCount} multa(s) pagada(s)`}
          />
        </Col>
      </Row>

      <DataTable<FineWithRelations>
        columns={finesColumns(vm)}
        data={table.rows}
        total={table.total}
        loading={table.loading}
        isError={table.isError}
        errorMessage={table.errorMessage}
        onRetry={table.retry}
        params={table.params}
        onPageChange={table.handlers.setPage}
        onSearch={table.handlers.setSearch}
        onSort={table.handlers.setSort}
        onFilter={table.handlers.setFilter}
        onDateRange={table.handlers.setDateRange}
        onReset={table.handlers.reset}
        hasActiveFilters={table.hasActiveFilters}
        showDateFilter
        filters={table.filters}
        searchPlaceholder="Buscar por motivo o descripcion"
        exportColumns={FINE_EXPORT_COLUMNS}
        exportFileName="multas"
        exportFetcher={table.exportFetcher}
        emptyTitle="Sin multas registradas"
        scrollX={1100}
        dataTour="data-table"
      />

      <FormDrawer
        open={form.open}
        title={form.title}
        description="Al registrar una multa se notifica automaticamente al propietario y arrendatario."
        onClose={vm.actions.close}
        onSubmit={form.submit}
        submitting={form.submitting}
        width={560}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            form.submit()
          }}
          noValidate
        >
          <SelectField
            control={form.control}
            name="apartment_id"
            label="Apartamento"
            required
            loading={form.apartmentsLoading}
            options={form.apartmentOptions}
          />

          <SelectField
            control={form.control}
            name="resident_id"
            label="Residente (opcional)"
            allowClear
            disabled={form.residentDisabled}
            loading={form.residentsLoading}
            options={form.residentOptions}
          />

          <TextField control={form.control} name="reason" label="Motivo" required maxLength={200} />

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <NumberField
              control={form.control}
              name="amount"
              label="Valor"
              min={0}
              step={10000}
              addonBefore="$"
              required
            />
            <SelectField
              control={form.control}
              name="status"
              label="Estado"
              options={form.statusOptions}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <DateField control={form.control} name="fine_date" label="Fecha de la multa" required />
            <DateField control={form.control} name="due_date" label="Fecha limite de pago" />
          </div>

          <TextAreaField
            control={form.control}
            name="description"
            label="Descripcion"
            rows={3}
            maxLength={2000}
          />
          <TextAreaField
            control={form.control}
            name="notes"
            label="Notas internas"
            rows={2}
            maxLength={1000}
          />
        </form>
      </FormDrawer>
    </>
  )
}
