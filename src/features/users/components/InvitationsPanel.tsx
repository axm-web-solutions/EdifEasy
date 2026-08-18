import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Card, List, Segmented, Space, Tag, Tooltip, Typography } from 'antd'
import { MailPlus, RefreshCw, Trash2 } from 'lucide-react'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import { invitationSchema, type InvitationFormValues } from '@/schemas/people'
import { SelectField, TextField } from '@/components/forms/fields'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states'
import { useInvitationMutations, useInvitations } from '@/hooks/useInvitations'
import { useAllApartments } from '@/hooks/useApartments'
import { ROLE_OPTIONS, roleColor } from '@/constants/roles'
import { formatDate, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { RoleCode } from '@/types/database'
import type { InvitationStatus } from '@/services/invitationService'

const { Text } = Typography

const STATUS_META: Record<InvitationStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'gold' },
  ACCEPTED: { label: 'Aceptada', color: 'green' },
  REVOKED: { label: 'Revocada', color: 'default' },
  EXPIRED: { label: 'Vencida', color: 'red' },
}

/**
 * Alta de usuarios por invitacion.
 *
 * Crear un usuario en Supabase Auth exige la clave secreta, que no puede vivir
 * en el navegador. La invitacion resuelve eso sin infraestructura extra: el
 * administrador reserva el correo con un rol, y la persona obtiene el acceso al
 * iniciar sesion (sin pasar por la cola de aprobacion).
 */
export function InvitationsPanel({ condominiumId }: { condominiumId: string }) {
  const [filter, setFilter] = useState<InvitationStatus | 'ALL'>('PENDING')
  const [formOpen, setFormOpen] = useState(false)

  const query = useInvitations(condominiumId, filter)
  const apartmentsQuery = useAllApartments(condominiumId)
  const { create, revoke } = useInvitationMutations()

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: '', role_code: 'OWNER', position: '', apartment_id: '' },
  })

  const role = form.watch('role_code')
  const needsApartment = role === 'OWNER' || role === 'TENANT'

  const submit = form.handleSubmit(async (values) => {
    await create.mutateAsync({
      condominiumId,
      email: values.email,
      roleCode: values.role_code as RoleCode,
      position: values.position || null,
      apartmentId: needsApartment ? values.apartment_id || null : null,
    })
    form.reset({ email: '', role_code: 'OWNER', position: '', apartment_id: '' })
    setFormOpen(false)
  })

  const invitations = query.data ?? []

  return (
    <>
      <Card
        className="surface-card"
        title={<span className="text-sm font-semibold">Invitaciones</span>}
        extra={
          <Space wrap>
            <Segmented
              size="small"
              value={filter}
              onChange={(value) => setFilter(value as InvitationStatus | 'ALL')}
              options={[
                { label: 'Pendientes', value: 'PENDING' },
                { label: 'Aceptadas', value: 'ACCEPTED' },
                { label: 'Todas', value: 'ALL' },
              ]}
            />
            <Tooltip title="Actualizar">
              <Button
                size="small"
                icon={<RefreshCw size={14} />}
                loading={query.isFetching}
                onClick={() => void query.refetch()}
              />
            </Tooltip>
            <Button
              type="primary"
              size="small"
              icon={<MailPlus size={14} />}
              onClick={() => setFormOpen(true)}
            >
              Invitar usuario
            </Button>
          </Space>
        }
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="Como funciona"
          description="Reservas un correo con un rol. Si la persona ya tiene cuenta, obtiene el acceso al iniciar sesion; si no, se registra en /register con ese mismo correo y entra directo, sin pasar por aprobacion."
        />

        {query.isLoading ? (
          <TableSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState
            description={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : invitations.length === 0 ? (
          <EmptyState
            title={filter === 'PENDING' ? 'Sin invitaciones pendientes' : 'Sin invitaciones'}
            description="Invita al administrador, los voceros, la celaduria o los residentes de este condominio."
          />
        ) : (
          <List
            dataSource={invitations}
            renderItem={(invitation) => (
              <List.Item
                actions={
                  invitation.status === 'PENDING'
                    ? [
                        <Tooltip key="revoke" title="Revocar invitacion">
                          <Button
                            size="small"
                            danger
                            icon={<Trash2 size={13} />}
                            onClick={async () => {
                              const ok = await confirmDelete({
                                title: `Revocar la invitacion a ${invitation.email}?`,
                                content: 'La persona ya no obtendra acceso con esa invitacion.',
                                okText: 'Revocar',
                              })
                              if (ok) await revoke.mutateAsync(invitation.id)
                            }}
                          />
                        </Tooltip>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={
                    <Space wrap size={6}>
                      <span className="font-medium text-slate-800">{invitation.email}</span>
                      <Tag color={roleColor(invitation.role_code)} bordered={false}>
                        {invitation.role_name}
                      </Tag>
                      <Tag color={STATUS_META[invitation.status].color} bordered={false}>
                        {STATUS_META[invitation.status].label}
                      </Tag>
                      {invitation.status === 'PENDING' ? (
                        <Tag bordered={false} color={invitation.user_exists ? 'blue' : 'default'}>
                          {invitation.user_exists ? 'Ya tiene cuenta' : 'Debe registrarse'}
                        </Tag>
                      ) : null}
                    </Space>
                  }
                  description={
                    <Text type="secondary" className="text-xs">
                      {invitation.apartment_number
                        ? `Apto ${invitation.apartment_number}${invitation.building_number ? ` · Edificio ${invitation.building_number}` : ''} · `
                        : ''}
                      {invitation.position ? `${invitation.position} · ` : ''}
                      Invitada por {invitation.invited_by_name ?? 'la administracion'} el{' '}
                      {formatDateTime(invitation.created_at)}
                      {invitation.status === 'PENDING'
                        ? ` · vence el ${formatDate(invitation.expires_at)}`
                        : ''}
                      {invitation.accepted_at
                        ? ` · aceptada el ${formatDateTime(invitation.accepted_at)}`
                        : ''}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <FormDrawer
        open={formOpen}
        title="Invitar usuario al condominio"
        description="Puedes asignar cualquier rol del condominio, incluido Administrador."
        onClose={() => setFormOpen(false)}
        onSubmit={() => void submit()}
        submitting={create.isPending}
        submitLabel="Crear invitacion"
      >
        <form onSubmit={submit} noValidate>
          <TextField
            control={form.control}
            name="email"
            label="Correo electronico"
            type="email"
            required
            placeholder="persona@dominio.com"
            help="Debe ser el mismo correo con el que la persona iniciara sesion."
          />

          <SelectField
            control={form.control}
            name="role_code"
            label="Rol en el condominio"
            required
            options={ROLE_OPTIONS}
          />

          <TextField control={form.control} name="position" label="Cargo (opcional)" />

          {needsApartment ? (
            <SelectField
              control={form.control}
              name="apartment_id"
              label="Apartamento (opcional)"
              allowClear
              loading={apartmentsQuery.isLoading}
              options={(apartmentsQuery.data ?? []).map((apartment) => ({
                value: apartment.id,
                label: `${apartment.building?.name ?? ''} · Apto ${apartment.number}`,
              }))}
              help="Si lo indicas, al aceptar la invitacion queda vinculado como propietario o arrendatario de ese apartamento."
            />
          ) : null}
        </form>
      </FormDrawer>
    </>
  )
}
