import { useState, type ReactNode } from 'react'
import { Button, Card, DatePicker, Input, Select, Space, Table, Tooltip } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue as AntFilterValue, SorterResult } from 'antd/es/table/interface'
import type { RangePickerProps } from 'antd/es/date-picker'
import { Download, FilterX, RotateCcw, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { exportData, type ExportColumn } from '@/utils/export'
import { notify } from '@/lib/notify'
import { getErrorMessage } from '@/lib/errors'
import { EmptyState, ErrorState, TableSkeleton } from './states'
import { MobileRecordList } from './MobileRecordList'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { FilterValue, ListParams, SortDirection } from '@/types/models'

const { RangePicker } = DatePicker

export interface TableFilterConfig {
  key: string
  label: string
  options: { value: string; label: string }[]
  multiple?: boolean
  width?: number
}

export interface DataTableProps<T> {
  columns: ColumnsType<T>
  data: T[]
  total: number
  loading: boolean
  isError?: boolean
  onRetry?: () => void
  errorMessage?: string

  params: ListParams
  onPageChange: (page: number, pageSize?: number) => void
  onSearch: (value: string) => void
  onSort: (sortBy: string | undefined, sortDir: SortDirection | undefined) => void
  onFilter: (key: string, value: FilterValue) => void
  onDateRange?: (from: string | null, to: string | null) => void
  onReset?: () => void
  hasActiveFilters?: boolean

  filters?: TableFilterConfig[]
  showDateFilter?: boolean
  dateFilterLabel?: string
  searchPlaceholder?: string

  toolbarActions?: ReactNode
  exportColumns?: ExportColumn<T>[]
  exportFileName?: string
  /** Permite exportar el dataset completo en lugar de solo la pagina visible. */
  exportFetcher?: () => Promise<T[]>

  rowKey?: string
  onRowClick?: (record: T) => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  scrollX?: number
  expandable?: React.ComponentProps<typeof Table<T>>['expandable']
}

export function DataTable<T extends object>({
  columns,
  data,
  total,
  loading,
  isError = false,
  onRetry,
  errorMessage,
  params,
  onPageChange,
  onSearch,
  onSort,
  onFilter,
  onDateRange,
  onReset,
  hasActiveFilters = false,
  filters = [],
  showDateFilter = false,
  dateFilterLabel = 'Rango de fechas',
  searchPlaceholder = 'Buscar...',
  toolbarActions,
  exportColumns,
  exportFileName = 'export',
  exportFetcher,
  rowKey = 'id',
  onRowClick,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'No hay registros que coincidan con los filtros aplicados.',
  emptyAction,
  scrollX = 900,
  expandable,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState(params.search ?? '')
  const [exporting, setExporting] = useState(false)
  const isMobile = useIsMobile()

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, AntFilterValue | null>,
    sorter: SorterResult<T> | SorterResult<T>[],
  ) => {
    const current = Array.isArray(sorter) ? sorter[0] : sorter
    if (!current?.order) {
      onSort(undefined, undefined)
      return
    }
    const field = Array.isArray(current.field) ? current.field.join('.') : String(current.field)
    onSort(field, current.order === 'ascend' ? 'asc' : 'desc')
  }

  const handleExport = async () => {
    if (!exportColumns) return
    setExporting(true)
    try {
      const rows = exportFetcher ? await exportFetcher() : data
      if (rows.length === 0) {
        notify.warning('No hay datos para exportar')
        return
      }
      exportData(rows, exportColumns, exportFileName, 'csv')
      notify.success(`${rows.length} registros exportados`)
    } catch (error) {
      notify.error(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const handleRangeChange: RangePickerProps['onChange'] = (values) => {
    if (!onDateRange) return
    if (!values || !values[0] || !values[1]) {
      onDateRange(null, null)
      return
    }
    onDateRange(values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD'))
  }

  const dateValue: RangePickerProps['value'] =
    params.dateFrom && params.dateTo ? [dayjs(params.dateFrom), dayjs(params.dateTo)] : null

  return (
    <Card className="surface-card" styles={{ body: { padding: 16 } }}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            allowClear
            value={searchValue}
            prefix={<Search size={15} className="text-slate-400" />}
            placeholder={searchPlaceholder}
            className="w-full sm:w-64"
            onChange={(event) => {
              setSearchValue(event.target.value)
              if (event.target.value === '') onSearch('')
            }}
            onPressEnter={() => onSearch(searchValue)}
            onBlur={() => {
              if (searchValue !== (params.search ?? '')) onSearch(searchValue)
            }}
          />

          {filters.map((filter) => (
            <Select
              key={filter.key}
              allowClear
              mode={filter.multiple ? 'multiple' : undefined}
              maxTagCount="responsive"
              placeholder={filter.label}
              style={{ minWidth: filter.width ?? 170 }}
              options={filter.options}
              value={(params.filters?.[filter.key] as string | string[] | undefined) ?? undefined}
              onChange={(value) => onFilter(filter.key, (value as FilterValue) ?? null)}
            />
          ))}

          {showDateFilter && onDateRange ? (
            <RangePicker
              placeholder={['Desde', 'Hasta']}
              format="DD/MM/YYYY"
              value={dateValue}
              onChange={handleRangeChange}
              title={dateFilterLabel}
              className="w-full sm:w-auto"
            />
          ) : null}

          {hasActiveFilters && onReset ? (
            <Tooltip title="Limpiar filtros">
              <Button icon={<FilterX size={15} />} onClick={onReset} />
            </Tooltip>
          ) : null}
        </div>

        <Space wrap>
          {onRetry ? (
            <Tooltip title="Actualizar">
              <Button icon={<RotateCcw size={15} />} onClick={onRetry} />
            </Tooltip>
          ) : null}
          {exportColumns ? (
            <Button icon={<Download size={15} />} loading={exporting} onClick={handleExport}>
              Exportar CSV
            </Button>
          ) : null}
          {toolbarActions}
        </Space>
      </div>

      {isError ? (
        <ErrorState description={errorMessage} onRetry={onRetry} />
      ) : isMobile ? (
        <MobileRecordList<T>
          columns={columns}
          data={data}
          total={total}
          loading={loading}
          params={params}
          onPageChange={onPageChange}
          onRowClick={onRowClick}
          rowKey={rowKey}
          emptyText={
            <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
          }
        />
      ) : loading && data.length === 0 ? (
        <TableSkeleton />
      ) : (
        <Table<T>
          columns={columns}
          dataSource={data}
          rowKey={rowKey}
          loading={loading && data.length > 0}
          size="middle"
          scroll={{ x: scrollX }}
          expandable={expandable}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
            ),
          }}
          onRow={
            onRowClick
              ? (record) => ({
                  onClick: () => onRowClick(record),
                  style: { cursor: 'pointer' },
                })
              : undefined
          }
          pagination={{
            current: params.page,
            pageSize: params.pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (count, range) => `${range[0]}-${range[1]} de ${count} registros`,
            onChange: onPageChange,
            responsive: true,
            size: 'default',
          }}
        />
      )}
    </Card>
  )
}
