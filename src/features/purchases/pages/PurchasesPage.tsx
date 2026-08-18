import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Card, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
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
import { usePurchaseMutations, usePurchases } from '@/hooks/usePurchases'
import { purchaseSchema, type PurchaseFormValues } from '@/schemas/finance'
import { PURCHASE_STATUS, toOptions } from '@/constants/enums'
import { purchaseService } from '@/services/purchaseService'
import { formatCurrency, formatDate } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { PurchaseItemRow, PurchaseRow } from '@/types/database'
import type { PurchaseWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<PurchaseWithRelations>[] = [
  { key: 'code', header: 'Codigo', value: (row) => row.code },
  { key: 'provider', header: 'Proveedor', value: (row) => row.provider },
  { key: 'date', header: 'Fecha', value: (row) => formatDate(row.purchase_date) },
  { key: 'total', header: 'Total', value: (row) => row.total },
  { key: 'status', header: 'Estado', value: (row) => PURCHASE_STATUS[row.status].label },
  { key: 'invoice', header: 'Factura', value: (row) => row.invoice_number },
  { key: 'items', header: 'Items', value: (row) => row.items?.length ?? 0 },
]

const EMPTY: PurchaseFormValues = {
  provider: '',
  purchase_date: dayjs().format('YYYY-MM-DD'),
  status: 'DRAFT',
  invoice_number: '',
  document_url: '',
  notes: '',
  items: [{ product: '', description: '', quantity: 1, unit_price: 0 }],
}

export function PurchasesPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageFinance')

  const table = useTableParams({ pageSize: 10 })
  const query = usePurchases(currentCondominiumId, table.params)
  const { create, update, remove } = usePurchaseMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PurchaseWithRelations | null>(null)

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: EMPTY,
  })

  const { fields, append, remove: removeItem } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')
  const total = (watchedItems ?? []).reduce(
    (sum, item) => sum + Number(item?.quantity ?? 0) * Number(item?.unit_price ?? 0),
    0,
  )

  useEffect(() => {
    if (!formOpen) return
    form.reset(
      editing
        ? {
            provider: editing.provider,
            purchase_date: editing.purchase_date,
            status: editing.status,
            invoice_number: editing.invoice_number ?? '',
            document_url: editing.document_url ?? '',
            notes: editing.notes ?? '',
            items:
              editing.items && editing.items.length > 0
                ? editing.items.map((item) => ({
                    id: item.id,
                    product: item.product,
                    description: item.description ?? '',
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                  }))
                : EMPTY.items,
          }
        : EMPTY,
    )
  }, [formOpen, editing, form])

  const submit = form.handleSubmit(async (values) => {
    if (!currentCondominiumId) return
    const payload = {
      condominium_id: currentCondominiumId,
      provider: values.provider,
      purchase_date: values.purchase_date,
      status: values.status,
      invoice_number: values.invoice_number || null,
      document_url: values.document_url || null,
      notes: values.notes || null,
      created_by: editing?.created_by ?? user?.id ?? null,
    }

    const items = values.items.map((item) => ({
      product: item.product,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }))

    if (editing) await update.mutateAsync({ id: editing.id, values: payload, items })
    else await create.mutateAsync({ values: payload, items })

    setFormOpen(false)
  })

  const columns: ColumnsType<PurchaseWithRelations> = [
    {
      title: 'Compra',
      key: 'code',
      fixed: 'left',
      width: 220,
      render: (_, row) => (
        <div>
          <Space size={6}>
            <Text code className="text-[11px]">
              {row.code ?? '—'}
            </Text>
            <span className="font-medium text-slate-800">{row.provider}</span>
          </Space>
          <Text type="secondary" className="block text-xs">
            {row.items?.length ?? 0} productos
          </Text>
        </div>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'purchase_date',
      key: 'purchase_date',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      sorter: true,
      align: 'right',
      width: 150,
      render: (value: number) => <strong>{formatCurrency(value)}</strong>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: PurchaseRow['status']) => (
        <Tag color={PURCHASE_STATUS[value].color} bordered={false}>
          {PURCHASE_STATUS[value].label}
        </Tag>
      ),
    },
    { title: 'Factura', dataIndex: 'invoice_number', key: 'invoice', width: 150, render: (v) => v ?? '—' },
    ...(canManage
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            fixed: 'right' as const,
            width: 110,
            render: (_: unknown, row: PurchaseWithRelations) => (
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
                      const ok = await confirmDelete({
                        title: `Eliminar la compra ${row.code ?? ''}?`,
                        content: 'Se eliminaran tambien todos sus productos.',
                      })
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
        title="Compras"
        subtitle="Ordenes de compra de insumos y servicios con su detalle de productos."
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
              Nueva compra
            </Button>
          ) : null
        }
      />

      <DataTable<PurchaseWithRelations>
        columns={columns}
        data={query.data?.data ?? []}
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
        filters={[{ key: 'status', label: 'Estado', options: toOptions(PURCHASE_STATUS) }]}
        searchPlaceholder="Buscar por proveedor, codigo o factura"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="compras"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await purchaseService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin compras registradas"
        scrollX={1000}
        expandable={{
          expandedRowRender: (row) => (
            <Table<PurchaseItemRow>
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={row.items ?? []}
              columns={[
                { title: 'Producto', dataIndex: 'product', key: 'product' },
                { title: 'Descripcion', dataIndex: 'description', key: 'description', render: (v) => v ?? '—' },
                { title: 'Cantidad', dataIndex: 'quantity', key: 'quantity', align: 'right' },
                {
                  title: 'Precio unitario',
                  dataIndex: 'unit_price',
                  key: 'unit_price',
                  align: 'right',
                  render: (value: number) => formatCurrency(value),
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  align: 'right',
                  render: (value: number) => <strong>{formatCurrency(value)}</strong>,
                },
              ]}
            />
          ),
        }}
      />

      <FormDrawer
        open={formOpen}
        title={editing ? `Editar compra ${editing.code ?? ''}` : 'Nueva compra'}
        description="El total se calcula automaticamente a partir de los productos."
        onClose={() => setFormOpen(false)}
        onSubmit={() => void submit()}
        submitting={create.isPending || update.isPending}
        width={680}
        footerExtra={<strong className="text-sm">Total: {formatCurrency(total)}</strong>}
      >
        <form onSubmit={submit} noValidate>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <TextField control={form.control} name="provider" label="Proveedor" required />
            <DateField control={form.control} name="purchase_date" label="Fecha de compra" required />
          </div>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="status"
              label="Estado"
              options={toOptions(PURCHASE_STATUS)}
              required
            />
            <TextField control={form.control} name="invoice_number" label="Numero de factura" />
          </div>

          <TextField control={form.control} name="document_url" label="Documento (URL)" placeholder="https://..." />

          <Card
            size="small"
            className="mb-4 border-slate-200"
            title={<span className="text-sm font-semibold">Productos</span>}
            extra={
              <Button
                size="small"
                icon={<Plus size={14} />}
                onClick={() => append({ product: '', description: '', quantity: 1, unit_price: 0 })}
              >
                Agregar
              </Button>
            }
          >
            {fields.map((field, index) => (
              <div key={field.id} className="mb-3 rounded-lg border border-slate-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Text type="secondary" className="text-xs">
                    Producto {index + 1}
                  </Text>
                  {fields.length > 1 ? (
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<X size={14} />}
                      onClick={() => removeItem(index)}
                    />
                  ) : null}
                </div>

                <TextField control={form.control} name={`items.${index}.product`} label="Nombre" required />
                <TextField control={form.control} name={`items.${index}.description`} label="Descripcion" />

                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  <NumberField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    label="Cantidad"
                    min={0.01}
                    step={1}
                    required
                  />
                  <NumberField
                    control={form.control}
                    name={`items.${index}.unit_price`}
                    label="Precio unitario"
                    min={0}
                    step={1000}
                    addonBefore="$"
                    required
                  />
                </div>

                <Text type="secondary" className="text-xs">
                  Subtotal:{' '}
                  {formatCurrency(
                    Number(watchedItems?.[index]?.quantity ?? 0) *
                      Number(watchedItems?.[index]?.unit_price ?? 0),
                  )}
                </Text>
              </div>
            ))}
          </Card>

          <TextAreaField control={form.control} name="notes" label="Notas" rows={3} maxLength={1000} />
        </form>
      </FormDrawer>
    </>
  )
}
