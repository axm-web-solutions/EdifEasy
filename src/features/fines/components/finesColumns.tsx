import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import { CreditCard, Pencil, Trash2 } from 'lucide-react'
import { FINE_STATUS } from '@/constants/enums'
import { formatCurrency, formatDate } from '@/utils/format'
import type { FineWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import type { FinesViewModel } from '../viewmodels/useFinesViewModel'

const { Text } = Typography

export const FINE_EXPORT_COLUMNS: ExportColumn<FineWithRelations>[] = [
  { key: 'apartment', header: 'Apartamento', value: (row) => row.apartment?.number ?? '' },
  { key: 'reason', header: 'Motivo', value: (row) => row.reason },
  { key: 'amount', header: 'Valor', value: (row) => row.amount },
  { key: 'date', header: 'Fecha', value: (row) => formatDate(row.fine_date) },
  { key: 'due', header: 'Vence', value: (row) => (row.due_date ? formatDate(row.due_date) : '') },
  { key: 'status', header: 'Estado', value: (row) => FINE_STATUS[row.status].label },
  { key: 'resident', header: 'Residente', value: (row) => row.resident?.full_name ?? '' },
]

/** Columnas de la tabla de multas. Solo presentacion: las decisiones vienen del ViewModel. */
export function finesColumns(vm: FinesViewModel): ColumnsType<FineWithRelations> {
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
      render: (value: FineWithRelations['status'], row) => (
        <Tooltip title={vm.row.paidHint(row)}>
          <Tag color={FINE_STATUS[value].color} bordered={false}>
            {FINE_STATUS[value].label}
          </Tag>
        </Tooltip>
      ),
    },
  ]

  // 'actions': en movil MobileRecordList lleva esta columna al pie de la tarjeta.
  if (vm.permissions.canPay) {
    columns.push({
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, row) =>
        vm.row.isPayable(row) ? (
          <Button
            type="primary"
            icon={<CreditCard size={14} />}
            loading={vm.row.isPaying(row)}
            disabled={vm.actions.paying}
            onClick={() => vm.actions.pay(row)}
          >
            Pagar
          </Button>
        ) : null,
    })
  }

  if (vm.permissions.canManage) {
    columns.push({
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Editar">
            <Button
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => vm.actions.openEdit(row)}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => void vm.actions.remove(row)}
            />
          </Tooltip>
        </Space>
      ),
    })
  }

  return columns
}
