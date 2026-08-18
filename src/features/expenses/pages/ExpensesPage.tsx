import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Col, Row, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Pencil, Plus, Receipt, Tags, Trash2, TrendingUp, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatCard } from '@/components/ui/StatCard'
import { AreaChartCard, PieChartCard } from '@/components/charts/charts'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import {
  ColorField,
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import {
  useExpenseCategories,
  useExpenseMutations,
  useExpenses,
  useExpensesByCategory,
  useExpensesMonthly,
} from '@/hooks/useExpenses'
import {
  expenseCategorySchema,
  expenseSchema,
  type ExpenseCategoryFormValues,
  type ExpenseFormValues,
} from '@/schemas/finance'
import { EXPENSE_STATUS, toOptions } from '@/constants/enums'
import { expenseService } from '@/services/expenseService'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { ExpenseRow } from '@/types/database'
import type { ExpenseWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<ExpenseWithRelations>[] = [
  { key: 'concept', header: 'Concepto', value: (row) => row.concept },
  { key: 'category', header: 'Categoria', value: (row) => row.category?.name ?? '' },
  { key: 'provider', header: 'Proveedor', value: (row) => row.provider },
  { key: 'amount', header: 'Valor', value: (row) => row.amount },
  { key: 'date', header: 'Fecha', value: (row) => formatDate(row.expense_date) },
  { key: 'invoice', header: 'Factura', value: (row) => row.invoice_number },
  { key: 'status', header: 'Estado', value: (row) => EXPENSE_STATUS[row.status].label },
]

const EMPTY_EXPENSE: ExpenseFormValues = {
  concept: '',
  category_id: null,
  provider: '',
  amount: 0,
  expense_date: dayjs().format('YYYY-MM-DD'),
  invoice_number: '',
  document_url: '',
  description: '',
  status: 'PENDING',
}

export function ExpensesPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageFinance')

  const table = useTableParams({ pageSize: 10 })
  const query = useExpenses(currentCondominiumId, table.params)
  const categoriesQuery = useExpenseCategories(currentCondominiumId)
  const monthlyQuery = useExpensesMonthly(currentCondominiumId, 6)
  const byCategoryQuery = useExpensesByCategory(currentCondominiumId)
  const { create, update, remove, createCategory } = useExpenseMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: EMPTY_EXPENSE,
  })

  const categoryForm = useForm<ExpenseCategoryFormValues>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: { name: '', code: '', color: '#2559eb', description: '' },
  })

  useEffect(() => {
    if (!formOpen) return
    form.reset(
      editing
        ? {
            concept: editing.concept,
            category_id: editing.category_id,
            provider: editing.provider ?? '',
            amount: editing.amount,
            expense_date: editing.expense_date,
            invoice_number: editing.invoice_number ?? '',
            document_url: editing.document_url ?? '',
            description: editing.description ?? '',
            status: editing.status,
          }
        : EMPTY_EXPENSE,
    )
  }, [formOpen, editing, form])

  const submit = form.handleSubmit(async (values) => {
    if (!currentCondominiumId) return
    const payload = {
      condominium_id: currentCondominiumId,
      concept: values.concept,
      category_id: values.category_id || null,
      provider: values.provider || null,
      amount: values.amount,
      expense_date: values.expense_date,
      invoice_number: values.invoice_number || null,
      document_url: values.document_url || null,
      description: values.description || null,
      status: values.status,
      created_by: editing?.created_by ?? user?.id ?? null,
    }

    if (editing) await update.mutateAsync({ id: editing.id, values: payload })
    else await create.mutateAsync(payload)
    setFormOpen(false)
  })

  const submitCategory = categoryForm.handleSubmit(async (values) => {
    if (!currentCondominiumId) return
    await createCategory.mutateAsync({
      condominium_id: currentCondominiumId,
      name: values.name,
      code: values.code || null,
      color: values.color,
      description: values.description || null,
    })
    categoryForm.reset({ name: '', code: '', color: '#2559eb', description: '' })
    setCategoryOpen(false)
  })

  const totalPeriod = (query.data?.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
  const monthTotal =
    monthlyQuery.data?.find((point) => point.period === dayjs().format('YYYY-MM'))?.total ?? 0
  const pendingTotal = (query.data?.data ?? [])
    .filter((row) => row.status === 'PENDING')
    .reduce((sum, row) => sum + Number(row.amount), 0)

  const columns: ColumnsType<ExpenseWithRelations> = [
    {
      title: 'Concepto',
      dataIndex: 'concept',
      key: 'concept',
      fixed: 'left',
      width: 250,
      render: (_, row) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{row.concept}</p>
          <Text type="secondary" className="text-xs">
            {row.provider ?? 'Sin proveedor'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Categoria',
      key: 'category',
      width: 160,
      render: (_, row) =>
        row.category ? (
          <Tag color="default" bordered={false} style={{ color: row.category.color }}>
            {row.category.name}
          </Tag>
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
      dataIndex: 'expense_date',
      key: 'expense_date',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    { title: 'Factura', dataIndex: 'invoice_number', key: 'invoice', width: 150, render: (v) => v ?? '—' },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: ExpenseRow['status']) => (
        <Tag color={EXPENSE_STATUS[value].color} bordered={false}>
          {EXPENSE_STATUS[value].label}
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
            render: (_: unknown, row: ExpenseWithRelations) => (
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
                      const ok = await confirmDelete({ title: `Eliminar el gasto "${row.concept}"?` })
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
        title="Gastos"
        subtitle="Control de egresos del condominio por categoria y proveedor."
        actions={
          canManage ? (
            <Space>
              <Button icon={<Tags size={16} />} onClick={() => setCategoryOpen(true)}>
                Nueva categoria
              </Button>
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Nuevo gasto
              </Button>
            </Space>
          ) : null
        }
      />

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={8}>
          <StatCard
            title="Gastos del mes"
            value={formatCompactCurrency(monthTotal)}
            icon={<Wallet size={20} />}
            tone="blue"
            loading={monthlyQuery.isLoading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Total pagina actual"
            value={formatCompactCurrency(totalPeriod)}
            icon={<Receipt size={20} />}
            tone="green"
            loading={query.isLoading}
            hint="Suma de los registros visibles con los filtros aplicados"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Pendientes por pagar"
            value={formatCompactCurrency(pendingTotal)}
            icon={<TrendingUp size={20} />}
            tone="orange"
            loading={query.isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} lg={14}>
          <AreaChartCard
            title="Gastos mensuales"
            subtitle="Ultimos 6 meses"
            currency
            height={250}
            loading={monthlyQuery.isLoading}
            data={(monthlyQuery.data ?? []).map((point) => ({ name: point.period, value: point.total }))}
          />
        </Col>
        <Col xs={24} lg={10}>
          <PieChartCard
            title="Distribucion por categoria"
            currency
            height={250}
            loading={byCategoryQuery.isLoading}
            data={(byCategoryQuery.data ?? []).map((point) => ({
              name: point.category,
              value: point.total,
              color: point.color,
            }))}
          />
        </Col>
      </Row>

      <DataTable<ExpenseWithRelations>
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
        dateFilterLabel="Rango de fechas del gasto"
        filters={[
          {
            key: 'category_id',
            label: 'Categoria',
            width: 190,
            options: (categoriesQuery.data ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            })),
          },
          { key: 'status', label: 'Estado', options: toOptions(EXPENSE_STATUS) },
        ]}
        searchPlaceholder="Buscar por concepto, proveedor o factura"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="gastos"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await expenseService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin gastos registrados"
        scrollX={1150}
      />

      <FormDrawer
        open={formOpen}
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        onClose={() => setFormOpen(false)}
        onSubmit={() => void submit()}
        submitting={create.isPending || update.isPending}
        width={560}
      >
        <form onSubmit={submit} noValidate>
          <TextField control={form.control} name="concept" label="Concepto" required />

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="category_id"
              label="Categoria"
              allowClear
              loading={categoriesQuery.isLoading}
              options={(categoriesQuery.data ?? []).map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
            <TextField control={form.control} name="provider" label="Proveedor" />
          </div>

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
            <DateField control={form.control} name="expense_date" label="Fecha del gasto" required />
          </div>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <TextField control={form.control} name="invoice_number" label="Numero de factura" />
            <SelectField
              control={form.control}
              name="status"
              label="Estado"
              options={toOptions(EXPENSE_STATUS)}
              required
            />
          </div>

          <TextField control={form.control} name="document_url" label="Documento (URL)" placeholder="https://..." />
          <TextAreaField control={form.control} name="description" label="Descripcion" rows={3} maxLength={1000} />
        </form>
      </FormDrawer>

      <FormDrawer
        open={categoryOpen}
        title="Nueva categoria de gasto"
        onClose={() => setCategoryOpen(false)}
        onSubmit={() => void submitCategory()}
        submitting={createCategory.isPending}
      >
        <form onSubmit={submitCategory} noValidate>
          <TextField control={categoryForm.control} name="name" label="Nombre" required />
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <TextField control={categoryForm.control} name="code" label="Codigo" placeholder="ADM" />
            <ColorField control={categoryForm.control} name="color" label="Color" required />
          </div>
          <TextAreaField control={categoryForm.control} name="description" label="Descripcion" rows={3} />
        </form>
      </FormDrawer>
    </>
  )
}
