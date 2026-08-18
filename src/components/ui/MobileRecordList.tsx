import type { ReactNode } from 'react'
import { Card, Empty, Pagination, Skeleton } from 'antd'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import type { ListParams } from '@/types/models'

/**
 * Vista de tarjetas para telefonos.
 *
 * Una tabla administrativa de 8-14 columnas no es usable en un telefono ni con
 * desplazamiento horizontal. Aqui se reutilizan EXACTAMENTE las mismas columnas
 * que la tabla (incluidos sus `render`), pero apiladas como etiqueta/valor:
 *   - la primera columna es el titulo de la tarjeta,
 *   - la columna `actions` va al pie,
 *   - el resto son filas etiqueta/valor.
 *
 * Asi no hay que mantener dos definiciones ni se pierde el formato de cada celda.
 */
type AnyColumn<T> = ColumnType<T> & { key?: React.Key }

function isPlainColumn<T>(column: ColumnsType<T>[number]): column is AnyColumn<T> {
  return !('children' in column)
}

function columnKey<T>(column: AnyColumn<T>, index: number): string {
  if (column.key !== undefined) return String(column.key)
  if (typeof column.dataIndex === 'string') return column.dataIndex
  return `col-${index}`
}

function readValue<T extends object>(column: AnyColumn<T>, record: T): unknown {
  const { dataIndex } = column
  if (dataIndex === undefined) return undefined

  if (Array.isArray(dataIndex)) {
    return dataIndex.reduce<unknown>((accumulator, key) => {
      if (accumulator && typeof accumulator === 'object') {
        return (accumulator as Record<string, unknown>)[String(key)]
      }
      return undefined
    }, record)
  }

  return (record as Record<string, unknown>)[String(dataIndex)]
}

function renderCell<T extends object>(
  column: AnyColumn<T>,
  record: T,
  index: number,
): ReactNode {
  const value = readValue(column, record)

  if (typeof column.render === 'function') {
    const rendered = column.render(value, record, index)
    // antd permite devolver { children, props }; aqui solo interesa el contenido.
    if (rendered && typeof rendered === 'object' && 'children' in rendered) {
      return (rendered as { children?: ReactNode }).children ?? null
    }
    return rendered as ReactNode
  }

  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Si' : 'No'
  if (typeof value === 'object') return null
  return String(value)
}

export function MobileRecordList<T extends object>({
  columns,
  data,
  total,
  loading,
  params,
  onPageChange,
  onRowClick,
  rowKey = 'id',
  emptyText,
}: {
  columns: ColumnsType<T>
  data: T[]
  total: number
  loading: boolean
  params: ListParams
  onPageChange: (page: number, pageSize?: number) => void
  onRowClick?: (record: T) => void
  rowKey?: string
  emptyText?: ReactNode
}) {
  const flat = columns.filter(isPlainColumn)
  const actionsColumn = flat.find((column, index) => columnKey(column, index) === 'actions')
  const visible = flat.filter((column, index) => columnKey(column, index) !== 'actions')
  const [titleColumn, ...detailColumns] = visible

  if (loading && data.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="surface-card" styles={{ body: { padding: 16 } }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return <>{emptyText ?? <Empty description="Sin resultados" />}</>
  }

  return (
    <div className="space-y-3">
      {data.map((record, index) => {
        const key = String((record as Record<string, unknown>)[rowKey] ?? index)

        return (
          <Card
            key={key}
            className="surface-card"
            styles={{ body: { padding: 14 } }}
            hoverable={Boolean(onRowClick)}
            onClick={onRowClick ? () => onRowClick(record) : undefined}
          >
            {titleColumn ? (
              <div className="mb-2 border-b border-slate-100 pb-2">
                {renderCell(titleColumn, record, index)}
              </div>
            ) : null}

            <dl className="m-0 space-y-1.5">
              {detailColumns.map((column, columnIndex) => {
                const content = renderCell(column, record, index)
                if (content === null || content === undefined || content === '') return null

                return (
                  <div
                    key={columnKey(column, columnIndex)}
                    className="flex items-start justify-between gap-3"
                  >
                    <dt className="shrink-0 text-xs uppercase tracking-wide text-slate-400">
                      {typeof column.title === 'string' ? column.title : null}
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 text-right text-sm text-slate-700">
                      {content}
                    </dd>
                  </div>
                )
              })}
            </dl>

            {actionsColumn ? (
              <div
                className="mt-3 flex justify-end border-t border-slate-100 pt-3"
                onClick={(event) => event.stopPropagation()}
              >
                {renderCell(actionsColumn, record, index)}
              </div>
            ) : null}
          </Card>
        )
      })}

      <div className="flex justify-center pt-2">
        <Pagination
          simple
          current={params.page}
          pageSize={params.pageSize}
          total={total}
          onChange={onPageChange}
          size="small"
        />
      </div>
    </div>
  )
}
