import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, Button, Card, Col, Descriptions, Row, Space, Tabs, Tag, Upload } from 'antd'
import { Camera, Save } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectField, TextField } from '@/components/forms/fields'
import { CondominiumForm } from '@/features/condominiums/components/CondominiumForm'
import { useAuth } from '@/hooks/useAuth'
import { useCondominium, useCondominiumMutations } from '@/hooks/useCondominiums'
import { profileSchema, type ProfileFormValues } from '@/schemas/auth'
import { DOCUMENT_TYPE_OPTIONS } from '@/constants/enums'
import { roleColor, roleLabel } from '@/constants/roles'
import { userService } from '@/services/userService'
import { storageService } from '@/services/storageService'
import { notify } from '@/lib/notify'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, initials } from '@/utils/format'
import { useQueryClient } from '@tanstack/react-query'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { profile, user, role, memberships, currentCondominiumId, hasPermission, refreshContext } =
    useAuth()
  const canManageCondominium = hasPermission('manageCondominium')

  const condominiumQuery = useCondominium(currentCondominiumId)
  const { update: updateCondominium } = useCondominiumMutations()

  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [condominiumOpen, setCondominiumOpen] = useState(false)

  const { control, handleSubmit, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: '', phone: '', document_type: 'CC', document_number: '' },
  })

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name,
        phone: profile.phone ?? '',
        document_type: profile.document_type ?? 'CC',
        document_number: profile.document_number ?? '',
      })
    }
  }, [profile, reset])

  const submitProfile = handleSubmit(async (values) => {
    if (!user) return
    setSavingProfile(true)
    try {
      await userService.updateProfile(user.id, {
        full_name: values.full_name,
        phone: values.phone || null,
        document_type: values.document_type || null,
        document_number: values.document_number || null,
      })
      notify.success('Perfil actualizado')
      await refreshContext()
    } catch (error) {
      notify.error(getErrorMessage(error))
    } finally {
      setSavingProfile(false)
    }
  })

  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    setUploadingAvatar(true)
    try {
      const url = await storageService.uploadAvatar(user.id, file)
      await userService.updateProfile(user.id, { avatar_url: url })
      notify.success('Foto de perfil actualizada')
      await refreshContext()
      await queryClient.invalidateQueries({ queryKey: ['user-context'] })
    } catch (error) {
      notify.error(getErrorMessage(error))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const profileTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card className="surface-card text-center">
          <Avatar
            size={96}
            src={profile?.avatar_url ?? undefined}
            style={{ backgroundColor: '#2559eb' }}
          >
            {initials(profile?.full_name)}
          </Avatar>
          <p className="mt-3 mb-0 text-base font-semibold text-slate-800">
            {profile?.full_name ?? 'Usuario'}
          </p>
          <p className="m-0 text-xs text-slate-500">{profile?.email}</p>
          <Tag className="mt-2" color={roleColor(role)} bordered={false}>
            {roleLabel(role)}
          </Tag>

          <div className="mt-4">
            <Upload
              accept="image/png,image/jpeg,image/webp"
              showUploadList={false}
              beforeUpload={(file) => {
                void handleAvatarUpload(file)
                return false
              }}
            >
              <Button icon={<Camera size={15} />} loading={uploadingAvatar}>
                Cambiar foto
              </Button>
            </Upload>
          </div>
        </Card>
      </Col>

      <Col xs={24} lg={16}>
        <Card className="surface-card" title="Datos personales">
          <form onSubmit={submitProfile} noValidate>
            <TextField control={control} name="full_name" label="Nombre completo" required />
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <SelectField
                control={control}
                name="document_type"
                label="Tipo de documento"
                options={DOCUMENT_TYPE_OPTIONS}
              />
              <TextField control={control} name="document_number" label="Numero de documento" />
            </div>
            <TextField control={control} name="phone" label="Telefono" />

            <Button type="primary" htmlType="submit" icon={<Save size={15} />} loading={savingProfile}>
              Guardar cambios
            </Button>
          </form>
        </Card>
      </Col>
    </Row>
  )

  const membershipsTab = (
    <Card className="surface-card" title="Mis condominios y roles">
      <Descriptions bordered column={1} size="small">
        {memberships.map((membership) => (
          <Descriptions.Item
            key={`${membership.condominium_id}-${membership.role_code}`}
            label={membership.condominium_name}
          >
            <Space wrap>
              <Tag color={roleColor(membership.role_code)} bordered={false}>
                {membership.role_name}
              </Tag>
              {membership.position ? <span className="text-xs">{membership.position}</span> : null}
              <Tag bordered={false}>{membership.status}</Tag>
            </Space>
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  )

  const condominiumTab = (
    <Card
      className="surface-card"
      title="Datos del condominio"
      extra={
        canManageCondominium ? (
          <Button size="small" type="primary" onClick={() => setCondominiumOpen(true)}>
            Editar
          </Button>
        ) : null
      }
      loading={condominiumQuery.isLoading}
    >
      {condominiumQuery.data ? (
        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Nombre">{condominiumQuery.data.name}</Descriptions.Item>
          <Descriptions.Item label="NIT">{condominiumQuery.data.nit ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Direccion">{condominiumQuery.data.address ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ciudad">{condominiumQuery.data.city ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Telefono">{condominiumQuery.data.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Correo">{condominiumQuery.data.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Estado">{condominiumQuery.data.status}</Descriptions.Item>
          <Descriptions.Item label="Creado">
            {formatDate(condominiumQuery.data.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="Descripcion" span={2}>
            {condominiumQuery.data.description ?? '—'}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Card>
  )

  return (
    <>
      <PageHeader title="Configuracion" subtitle="Perfil, roles y datos del condominio." />

      <Tabs
        defaultActiveKey="profile"
        items={[
          { key: 'profile', label: 'Mi perfil', children: profileTab },
          { key: 'memberships', label: 'Mis roles', children: membershipsTab },
          { key: 'condominium', label: 'Condominio', children: condominiumTab },
        ]}
      />

      <CondominiumForm
        open={condominiumOpen}
        condominium={condominiumQuery.data ?? null}
        submitting={updateCondominium.isPending}
        onClose={() => setCondominiumOpen(false)}
        onSubmit={(values) => {
          if (!currentCondominiumId) return
          void updateCondominium
            .mutateAsync({ id: currentCondominiumId, values })
            .then(() => setCondominiumOpen(false))
        }}
      />
    </>
  )
}
