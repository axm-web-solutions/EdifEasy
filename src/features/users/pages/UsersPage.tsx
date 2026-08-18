import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Avatar, Button, Space, Tabs, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link2, Pencil, Trash2, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import { SelectField, TextField } from '@/components/forms/fields'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useMemberMutations, useMembers, useRoles } from '@/hooks/useMembers'
import {
  memberSchema,
  memberUpdateSchema,
  type MemberFormValues,
  type MemberUpdateFormValues,
} from '@/schemas/people'
import { MEMBER_STATUS, toOptions } from '@/constants/enums'
import { ROLE_OPTIONS, roleColor } from '@/constants/roles'
import { userService } from '@/services/userService'
import { formatDate, initials } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import type { MemberWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'
import { InvitationsPanel } from '../components/InvitationsPanel'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<MemberWithRelations>[] = [
  {
    key: 'name',
    header: 'Nombre',
    value: (row) => row.profile?.full_name ?? '',
  },
  { key: 'email', header: 'Correo', value: (row) => row.profile?.email ?? '' },
  {
    key: 'phone',
    header: 'Telefono',
    value: (row) => row.profile?.phone ?? '',
  },
  { key: 'role', header: 'Rol', value: (row) => row.role?.name ?? '' },
  { key: 'position', header: 'Cargo', value: (row) => row.position ?? '' },
  {
    key: 'status',
    header: 'Estado',
    value: (row) => MEMBER_STATUS[row.status].label,
  },
  {
    key: 'joined',
    header: 'Vinculado',
    value: (row) => formatDate(row.joined_at),
  },
]

export function UsersPage() {
  const { currentCondominiumId, hasPermission } = useAuth()
  const canManage = hasPermission('manageMembers')

  const table = useTableParams({ pageSize: 10 })
  const query = useMembers(currentCondominiumId, table.params)
  const rolesQuery = useRoles()
  const { addByEmail, update, remove } = useMemberMutations()

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<MemberWithRelations | null>(null)

  const addForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { email: '', role_code: 'OWNER', position: '' },
  })

  const editForm = useForm<MemberUpdateFormValues>({
    resolver: zodResolver(memberUpdateSchema),
    defaultValues: { role_id: '', status: 'ACTIVE', position: '' },
  })

  const submitAdd = addForm.handleSubmit(async (values) => {
    if (!currentCondominiumId) return
    await addByEmail.mutateAsync({
      condominiumId: currentCondominiumId,
      email: values.email,
      roleCode: values.role_code,
      position: values.position || null,
    })
    addForm.reset({ email: '', role_code: 'OWNER', position: '' })
    setAddOpen(false)
  })

  const submitEdit = editForm.handleSubmit(async (values) => {
    if (!editing) return
    await update.mutateAsync({
      id: editing.id,
      values: {
        role_id: values.role_id,
        status: values.status,
        position: values.position || null,
      },
    })
    setEditing(null)
  })

  const openEdit = (member: MemberWithRelations) => {
    setEditing(member)
    editForm.reset({
      role_id: member.role_id,
      status: member.status,
      position: member.position ?? '',
    })
  }

  const columns: ColumnsType<MemberWithRelations> = [
    {
      title: 'Usuario',
      key: 'user',
      fixed: 'left',
      width: 260,
      render: (_, row) => (
        <Space>
          <Avatar src={row.profile?.avatar_url ?? undefined} style={{ backgroundColor: '#2559eb' }}>
            {initials(row.profile?.full_name)}
          </Avatar>
          <div className="min-w-0">
            <p className="m-0 font-medium text-slate-800">{row.profile?.full_name ?? 'Usuario'}</p>
            <Text type="secondary" className="text-xs">
              {row.profile?.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Rol',
      key: 'role',
      width: 160,
      render: (_, row) => (
        <Tag color={roleColor(row.role?.code)} bordered={false}>
          {row.role?.name ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Cargo',
      dataIndex: 'position',
      key: 'position',
      render: (v) => v ?? '—',
    },
    {
      title: 'Telefono',
      key: 'phone',
      render: (_, row) => row.profile?.phone ?? '—',
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: MemberWithRelations['status']) => (
        <Tag color={MEMBER_STATUS[value].color} bordered={false}>
          {MEMBER_STATUS[value].label}
        </Tag>
      ),
    },
    {
      title: 'Vinculado',
      dataIndex: 'joined_at',
      key: 'joined_at',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, row) =>
        canManage ? (
          <Space size={4}>
            <Tooltip title="Editar rol y estado">
              <Button size="small" icon={<Pencil size={14} />} onClick={() => openEdit(row)} />
            </Tooltip>
            <Tooltip title="Quitar del condominio">
              <Button
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={async () => {
                  const ok = await confirmDelete({
                    title: `Quitar a ${row.profile?.full_name ?? 'este usuario'}?`,
                    content:
                      'El usuario perdera el acceso a este condominio. Su cuenta no se elimina.',
                    okText: 'Quitar',
                  })
                  if (ok) await remove.mutateAsync(row.id)
                }}
              />
            </Tooltip>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Usuarios del condominio"
        subtitle="Administra los usuarios vinculados y su rol dentro del condominio."
        actions={
          canManage ? (
            <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setAddOpen(true)}>
              Vincular usuario
            </Button>
          ) : null
        }
      />

      <Tabs
        defaultActiveKey="members"
        items={[
          {
            key: 'members',
            label: 'Miembros activos',
            children: (
              <DataTable<MemberWithRelations>
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
                filters={[
                  {
                    key: 'role_id',
                    label: 'Rol',
                    width: 180,
                    options: (rolesQuery.data ?? [])
                      .filter((role) => role.code !== 'SUPER_ADMIN')
                      .map((role) => ({ value: role.id, label: role.name })),
                  },
                  {
                    key: 'status',
                    label: 'Estado',
                    options: toOptions(MEMBER_STATUS),
                  },
                ]}
                searchPlaceholder="La busqueda de usuarios se realiza por rol y estado"
                exportColumns={EXPORT_COLUMNS}
                exportFileName="usuarios"
                exportFetcher={async () => {
                  if (!currentCondominiumId) return []
                  const result = await userService.listMembers(currentCondominiumId, {
                    ...table.params,
                    page: 1,
                    pageSize: 1000,
                  })
                  return result.data
                }}
                emptyTitle="Sin usuarios vinculados"
                emptyDescription="Invita usuarios o vincula cuentas ya registradas para darles acceso."
                scrollX={1050}
              />
            ),
          },
          ...(canManage && currentCondominiumId
            ? [
                {
                  key: 'invitations',
                  label: 'Invitaciones',
                  children: <InvitationsPanel condominiumId={currentCondominiumId} />,
                },
              ]
            : []),
        ]}
      />

      <FormDrawer
        open={addOpen}
        title="Vincular usuario al condominio"
        description="El usuario debe estar registrado previamente en la plataforma."
        onClose={() => setAddOpen(false)}
        onSubmit={() => void submitAdd()}
        submitting={addByEmail.isPending}
        submitLabel="Vincular"
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          icon={<Link2 size={16} />}
          message="Como funciona"
          description="Ingresa el correo exacto de un usuario ya registrado. Si aun no tiene cuenta, pidele que se registre en /register y luego vinculalo aqui."
        />
        <form onSubmit={submitAdd} noValidate>
          <TextField
            control={addForm.control}
            name="email"
            label="Correo del usuario"
            type="email"
            required
            placeholder="usuario@dominio.com"
          />
          <SelectField
            control={addForm.control}
            name="role_code"
            label="Rol en el condominio"
            required
            options={ROLE_OPTIONS}
          />
          <TextField control={addForm.control} name="position" label="Cargo (opcional)" />
        </form>
      </FormDrawer>

      <FormDrawer
        open={Boolean(editing)}
        title={`Editar ${editing?.profile?.full_name ?? 'usuario'}`}
        onClose={() => setEditing(null)}
        onSubmit={() => void submitEdit()}
        submitting={update.isPending}
      >
        <form onSubmit={submitEdit} noValidate>
          <SelectField
            control={editForm.control}
            name="role_id"
            label="Rol"
            required
            loading={rolesQuery.isLoading}
            options={(rolesQuery.data ?? [])
              .filter((role) => role.code !== 'SUPER_ADMIN')
              .map((role) => ({ value: role.id, label: role.name }))}
          />
          <SelectField
            control={editForm.control}
            name="status"
            label="Estado"
            required
            options={toOptions(MEMBER_STATUS)}
          />
          <TextField control={editForm.control} name="position" label="Cargo" />
        </form>
      </FormDrawer>
    </>
  )
}
