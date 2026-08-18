import { useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Input,
  List,
  Modal,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { Car, Check, RefreshCw, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import {
  useRegistrationRequests,
  useRegistrationReviewMutations,
} from '@/hooks/useRegistrationRequests'
import { formatDateTime, initials } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { RegistrationStatus } from '@/types/database'
import type { RegistrationRequestReview } from '@/services/registrationService'

const { Paragraph, Text } = Typography

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario',
  TENANT: 'Arrendatario',
  BOTH: 'Propietario y arrendatario',
}

const STATUS_META: Record<RegistrationStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'gold' },
  APPROVED: { label: 'Aprobada', color: 'green' },
  REJECTED: { label: 'Rechazada', color: 'red' },
  CANCELLED: { label: 'Cancelada', color: 'default' },
}

export function ApprovalsPage() {
  const { currentCondominiumId } = useAuth()
  const [filter, setFilter] = useState<RegistrationStatus | 'ALL'>('PENDING')
  const [rejecting, setRejecting] = useState<RegistrationRequestReview | null>(null)
  const [reason, setReason] = useState('')

  const query = useRegistrationRequests(currentCondominiumId, filter)
  const { approve, reject } = useRegistrationReviewMutations()

  const handleApprove = (request: RegistrationRequestReview) => {
    Modal.confirm({
      title: `Aprobar la inscripcion de ${request.full_name}?`,
      content: `Se le dara acceso como ${ROLE_LABEL[request.requested_role]} del apartamento ${request.apartment_number} (edificio ${request.building_number}).`,
      okText: 'Aprobar',
      cancelText: 'Cancelar',
      onOk: () => approve.mutateAsync({ requestId: request.id }),
    })
  }

  const handleReject = async () => {
    if (!rejecting || !reason.trim()) return
    await reject.mutateAsync({ requestId: rejecting.id, reason: reason.trim() })
    setRejecting(null)
    setReason('')
  }

  const requests = query.data ?? []

  return (
    <>
      <PageHeader
        title="Aprobaciones de inscripcion"
        subtitle="Autoriza o rechaza a quienes se registran como propietarios o arrendatarios."
        actions={
          <Space>
            <Segmented
              value={filter}
              onChange={(value) => setFilter(value as RegistrationStatus | 'ALL')}
              options={[
                { label: 'Pendientes', value: 'PENDING' },
                { label: 'Aprobadas', value: 'APPROVED' },
                { label: 'Rechazadas', value: 'REJECTED' },
                { label: 'Todas', value: 'ALL' },
              ]}
            />
            <Tooltip title="Actualizar">
              <Button
                icon={<RefreshCw size={15} />}
                loading={query.isFetching}
                onClick={() => void query.refetch()}
              />
            </Tooltip>
          </Space>
        }
      />

      <Card className="surface-card">
        {query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState
            description={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            title={filter === 'PENDING' ? 'No hay solicitudes pendientes' : 'Sin solicitudes'}
            description={
              filter === 'PENDING'
                ? 'Cuando alguien se registre eligiendo un apartamento de este condominio, aparecera aqui para tu aprobacion.'
                : 'No hay solicitudes con ese estado.'
            }
          />
        ) : (
          <List
            dataSource={requests}
            itemLayout="vertical"
            renderItem={(request) => (
              <List.Item
                key={request.id}
                actions={
                  request.status === 'PENDING'
                    ? [
                        <Button
                          key="approve"
                          type="primary"
                          icon={<Check size={15} />}
                          loading={approve.isPending}
                          onClick={() => handleApprove(request)}
                        >
                          Aprobar
                        </Button>,
                        <Button
                          key="reject"
                          danger
                          icon={<X size={15} />}
                          onClick={() => {
                            setRejecting(request)
                            setReason('')
                          }}
                        >
                          Rechazar
                        </Button>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  avatar={
                    <Avatar size={44} style={{ backgroundColor: '#2559eb' }}>
                      {initials(request.full_name)}
                    </Avatar>
                  }
                  title={
                    <Space wrap>
                      <span className="font-medium text-slate-800">{request.full_name}</span>
                      <Tag color={STATUS_META[request.status].color} bordered={false}>
                        {STATUS_META[request.status].label}
                      </Tag>
                      <Tag bordered={false}>{ROLE_LABEL[request.requested_role]}</Tag>
                    </Space>
                  }
                  description={
                    <Text type="secondary" className="text-xs">
                      {request.email}
                      {request.phone ? ` · ${request.phone}` : ''}
                      {request.document_number ? ` · Doc. ${request.document_number}` : ''}
                      {' · '}
                      {formatDateTime(request.created_at)}
                    </Text>
                  }
                />

                <Descriptions size="small" column={{ xs: 1, sm: 2 }} className="mt-2">
                  <Descriptions.Item label="Edificio">{request.building_number}</Descriptions.Item>
                  <Descriptions.Item label="Apartamento">
                    {request.apartment_number}
                  </Descriptions.Item>
                  {request.vehicles.length > 0 ? (
                    <Descriptions.Item label="Vehiculos" span={2}>
                      <Space wrap size={4}>
                        {request.vehicles.map((vehicle) => (
                          <Tag key={vehicle.plate} bordered={false} icon={<Car size={12} />}>
                            {vehicle.plate}
                          </Tag>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  ) : null}
                  {request.applicant_note ? (
                    <Descriptions.Item label="Mensaje" span={2}>
                      <Paragraph className="!mb-0 text-sm">{request.applicant_note}</Paragraph>
                    </Descriptions.Item>
                  ) : null}
                  {request.review_notes ? (
                    <Descriptions.Item label="Nota de revision" span={2}>
                      <Paragraph className="!mb-0 text-sm">{request.review_notes}</Paragraph>
                    </Descriptions.Item>
                  ) : null}
                  {request.reviewer_name ? (
                    <Descriptions.Item label="Revisada por" span={2}>
                      {request.reviewer_name}
                      {request.reviewed_at ? ` · ${formatDateTime(request.reviewed_at)}` : ''}
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        open={Boolean(rejecting)}
        title={`Rechazar la solicitud de ${rejecting?.full_name ?? ''}`}
        okText="Rechazar"
        okButtonProps={{ danger: true, disabled: !reason.trim() }}
        cancelText="Cancelar"
        confirmLoading={reject.isPending}
        onOk={() => void handleReject()}
        onCancel={() => {
          setRejecting(null)
          setReason('')
        }}
      >
        <p className="text-sm text-slate-600">
          El motivo se le enviara al usuario como notificacion, y podra corregir y reenviar su
          solicitud.
        </p>
        <Input.TextArea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={500}
          showCount
          placeholder="Ej: el apartamento 301 ya tiene propietario registrado; verifica el numero."
        />
      </Modal>
    </>
  )
}
