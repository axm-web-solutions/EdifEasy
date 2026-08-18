import { Avatar, Button, Dropdown, Select, Space, Tag, Tooltip, Typography } from 'antd'
import { LogOut, Menu as MenuIcon, Settings, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { roleColor, roleLabel } from '@/constants/roles'
import { initials } from '@/utils/format'
import { NotificationBell } from './NotificationBell'
import { GlobalSearch } from './GlobalSearch'

const { Text } = Typography

export function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const navigate = useNavigate()
  const {
    profile,
    memberships,
    currentCondominiumId,
    setCurrentCondominium,
    role,
    signOut,
    user,
  } = useAuth()

  const condominiumOptions = memberships.map((membership) => ({
    value: membership.condominium_id,
    label: membership.condominium_name,
  }))

  const uniqueOptions = condominiumOptions.filter(
    (option, index, list) => list.findIndex((candidate) => candidate.value === option.value) === index,
  )

  return (
    <div className="flex h-full items-center gap-3 px-3 md:px-5">
      <Button
        type="text"
        className="lg:hidden"
        icon={<MenuIcon size={20} />}
        onClick={onOpenDrawer}
        aria-label="Abrir menu"
      />

      <div className="hidden flex-1 md:block">
        <GlobalSearch />
      </div>
      <div className="flex-1 md:hidden" />

      <Space size="middle" align="center">
        {uniqueOptions.length > 0 ? (
          <Tooltip title="Condominio activo">
            <Select
              value={currentCondominiumId ?? undefined}
              options={uniqueOptions}
              onChange={setCurrentCondominium}
              className="min-w-[150px] max-w-[220px]"
              size="middle"
              showSearch
              optionFilterProp="label"
            />
          </Tooltip>
        ) : null}

        <NotificationBell />

        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'profile-info',
                label: (
                  <div className="py-1">
                    <p className="m-0 text-sm font-medium text-slate-800">
                      {profile?.full_name ?? 'Usuario'}
                    </p>
                    <p className="m-0 text-xs text-slate-500">{profile?.email ?? user?.email}</p>
                    <Tag className="mt-1" color={roleColor(role)} bordered={false}>
                      {roleLabel(role)}
                    </Tag>
                  </div>
                ),
                disabled: true,
              },
              { type: 'divider' },
              {
                key: 'profile',
                label: 'Mi perfil',
                icon: <User size={15} />,
                onClick: () => navigate('/settings'),
              },
              {
                key: 'settings',
                label: 'Configuracion',
                icon: <Settings size={15} />,
                onClick: () => navigate('/settings'),
              },
              { type: 'divider' },
              {
                key: 'logout',
                label: 'Cerrar sesion',
                icon: <LogOut size={15} />,
                danger: true,
                onClick: () => {
                  void signOut().then(() => navigate('/login', { replace: true }))
                },
              },
            ],
          }}
        >
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border-0 bg-transparent px-1 py-1 cursor-pointer hover:bg-slate-50"
          >
            <Avatar
              size={34}
              src={profile?.avatar_url ?? undefined}
              style={{ backgroundColor: '#2559eb' }}
            >
              {initials(profile?.full_name)}
            </Avatar>
            <div className="hidden text-left lg:block">
              <Text className="block text-sm font-medium leading-4 text-slate-800">
                {profile?.full_name ?? 'Usuario'}
              </Text>
              <Text type="secondary" className="block text-[11px] leading-4">
                {roleLabel(role)}
              </Text>
            </div>
          </button>
        </Dropdown>
      </Space>
    </div>
  )
}
