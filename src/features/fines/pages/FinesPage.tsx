import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Col, Row, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { CircleDollarSign, Gavel, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatCard } from '@/components/ui/StatCard'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import {
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useFineMutations, useFines } from '@/hooks/useFines'
import { useAllApartments } from '@/hooks/useApartments'
import { useResidentsByApartment } from '@/hooks/useResidents'
import { fineSchema, type FineFormValues } from '@/schemas/operations'
import { FINE_STATUS, toOptions } from '@/constants/enums'
import { fineService } from '@/services/fineService'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { FineRow } from '@/types/database'
import type { FineWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<FineWithRelations>[] = [
  { key: 'apartment', header: 'Apartamento', value: (row) => row.apartment?.number ?? '' },
  { key: 'reason', header: 'Motivo', value: (row) => row.reason },
  { key: 'amount', header: 'Valor', value: (row) => row.amount },
  { key: 'date', header: 'Fecha', value: (row) => formatDate(row.fine_date) },
  { key: 'due', header: 'Vence', value: (row) => (row.due_date ? formatDate(row.due_date) : '') },
  { key: 'status', header: 'Estado', value: (row) => FINE_STATUS[row.status].label },
  { key: 'resident', header: 'Residente', value: (row) => row.resident?.full_name ?? '' },
]

const EMPTY: FineFormValues = {
  apartment_id: '',
  resident_id: null,
  reason: '',
  description: '',
  amount: 0,
  fine_date: dayjs().format('YYYY-MM-DD'),
  due_date: null,
  status: 'PENDING',
  notes: '',
}

export function FinesPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageFines')

  const table = useTableParams({ pageSize: 10 })
  const query = useFines(currentCondominiumId, table.params)
  const apartmentsQuery = useAllApartments(currentCondominiumId)
  const { create, update, remove } = useFineMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FineRow | null>(null)

  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineSchema),
    defaultValues: EMPTY,
  })

  const selectedApartment = useWatch({ control: form.control, name: 'apartment_id' })
  const residentsQuery = useResidentsByApartment(selectedApartment || null)

  useEffect(() => {
    if (!formOpen) return
    form.reset(
      editing
        ? {
            apartment_id: editing.apartment_id,
            resident_id: editing.resident_id,
            reason: editing.reason,
            description: editing.description ?? '',
            amount: editing.amount,
            fine_date: editing.fine_date,
            due_date: editing.due_date,
            status: editing.status,
            notes: editing.notes ?? '',
          }
        : EMPTY,
    )
  }, [formOpen, editing, form])

  const submit = form.handleSubmit(async (values) => {
    if (!currentCondominiumId) return
    const payload = {
      condominium_id: currentCondominiumId,
      apartment_id: values.apartment_id,
      resident_id: values.resident_id || null,
      reason: values.reason,
      description: values.description || null,
      amount: values.amount,
      fine_date: values.fine_date,
      due_date: values.due_date || null,
      status: values.status,
      notes: values.notes || null,
      created_by: editing?.created_by ?? user?.id ?? null,
    }

    if (editing) await update.mutateAsync({ id: editing.id, values: payload })
    else await create.mutateAsync(payload)
    setFormOpen(false)
  })

  const rows = query.data?.data ?? []
  const pendingAmount = rows
    .filter((row) => row.status === 'PENDING')
    .reduce((sum, row) => sum + Number(row.amount), 0)
  const paidAmount = rows
    .filter((row) => row.status === 'PAID')
    .reduce((sum, row) => sum + Number(row.amount), 0)

  const columns: ColumnsType<FineWithRelations> = [
    {
      title: 'Multa',
      dataIndex: 'reason',
      key: 'reason',
      fixed: 'left',
      width: 280,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.reason}</p>
          <Text type="secondary" className="text-xs">
            {row.resident?.full_name ?? 'Sin residente asociado'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Apartamento',
      key: 'apartment',
      width: 140,
      render: (_, row) =>
        row.apartment ? (
          <Link to={`/apartments/${row.apartment.id}`}>Apto {row.apartment.number}</Link>
        ) : (
          '—'
        ),
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      key: 'amount',
      sorter: true,
      align: 'right',
      width: 140,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
    },
    {
      title: 'Fecha',
      dataIndex: 'fine_date',
      key: 'fine_date',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Vence',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : '—'),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: FineRow['status']) => (
        <Tag color={FINE_STATUS[value].color} bordered={false}>
          {FINE_STATUS[value].label}
        </Tag>
      ),
    },
    ...(canManage
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            fixed: 'right' as const,
            width: 110,
            render: (_: unknown, row: FineWithRelations) => (
              <Space size={4}>
                <Tooltip title="Editar">
                  <Button
                    size="small"
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      setEditing(row)
                      setFormOpen(true)
                    }}
                  />
                </Tooltip>
                <Tooltip title="Eliminar">
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={async () => {
                      const ok = await confirmDelete({ title: `Eliminar la multa "${row.reason}"?` })
                      if (ok) await remove.mutateAsync(row.id)
                    }}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Multas"
        subtitle="Sanciones por incumplimiento del reglamento de propiedad horizontal."
        actions={
          canManage ? (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              Nueva multa
            </Button>
          ) : null
        }
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12}>
          <StatCard
            title="Pendiente por cobrar"
            value={formatCompactCurrency(pendingAmount)}
            icon={<Gavel size={20} />}
            tone="orange"
            loading={query.isLoading}
            hint="Suma de los registros visibles con los filtros aplicados"
          />
        </Col>
        <Col xs={24} sm={12}>
          <StatCard
            title="Recaudado"
            value={formatCompactCurrency(paidAmount)}
            icon={<CircleDollarSign size={20} />}
            tone="green"
            loading={query.isLoading}
          />
        </Col>
      </Row>

      <DataTable<FineWithRelations>
        columns={columns}
        data={rows}
        total={query.data?.total ?? 0}
        loading={query.isFetching}
        isError={query.isError}
        errorMessage={query.error ? getErrorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
        params={table.params}
        onPageChange={table.setPage}
        onSearch={table.setSearch}
        onSort={table.setSort}
        onFilter={table.setFilter}
        onDateRange={table.setDateRange}
        onReset={table.reset}
        hasActiveFilters={table.hasActiveFilters}
        showDateFilter
        filters={[
          { key: 'status', label: 'Estado', options: toOptions(FINE_STATUS) },
          {
            key: 'apartment_id',
            label: 'Apartamento',
            width: 190,
            options: (apartmentsQuery.data ?? []).map((apartment) => ({
              value: apartment.id,
              label: `${apartment.building?.name ?? ''} · ${apartment.number}`,
            })),
          },
        ]}
        searchPlaceholder="Buscar por motivo o descripcion"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="multas"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await fineService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin multas registradas"
        scrollX={1100}
      />

      <FormDrawer
        open={formOpen}
        title={editing ? 'Editar multa' : 'Nueva multa'}
        description="Al registrar una multa se notifica automaticamente al propietario y arrendatario."
        onClose={() => setFormOpen(false)}
        onSubmit={() => void submit()}
        submitting={create.isPending || update.isPending}
        width={560}
      >
        <form onSubmit={submit} noValidate>
          <SelectField
            control={form.control}
            name="apartment_id"
            label="Apartamento"
            required
            loading={apartmentsQuery.isLoading}
            options={(apartmentsQuery.data ?? []).map((apartment) => ({
              value: apartment.id,
              label: `${apartment.building?.name ?? ''} · Apto ${apartment.number}`,
            }))}
          />

          <SelectField
            control={form.control}
            name="resident_id"
            label="Residente (opcional)"
            allowClear
            disabled={!selectedApartment}
            loading={residentsQuery.isLoading}
            options={(residentsQuery.data ?? []).map((resident) => ({
              value: resident.id,
              label: resident.full_name,
            }))}
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
              options={toOptions(FINE_STATUS)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <DateField control={form.control} name="fine_date" label="Fecha de la multa" required />
            <DateField control={form.control} name="due_date" label="Fecha limite de pago" />
          </div>

          <TextAreaField control={form.control} name="description" label="Descripcion" rows={3} maxLength={2000} />
          <TextAreaField control={form.control} name="notes" label="Notas internas" rows={2} maxLength={1000} />
        </form>
      </FormDrawer>
    </>
  )
}
