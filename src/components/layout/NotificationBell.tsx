import { useState } from 'react'
import { Badge, Button, Dropdown, Empty, List, Space, Tag, Tooltip, Typography } from 'antd'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  useNotificationMutations,
  useNotifications,
  useUnreadNotificationsCount,
} from '@/hooks/useNotifications'
import { NOTIFICATION_TYPE, PRIORITY_LEVEL } from '@/constants/enums'
import { formatRelative } from '@/utils/format'

const { Text } = Typography

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const notificationsQuery = useNotifications(20)
  const unreadQuery = useUnreadNotificationsCount()
  const { markAsRead, markAllAsRead, remove } = useNotificationMutations()

  const notifications = notificationsQuery.data ?? []
  const unread = unreadQuery.data ?? 0

  const panel = (
    <div className="w-[340px] max-w-[92vw] rounded-xl bg-white shadow-elevated border border-slate-100">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <Text strong>Notificaciones</Text>
        <Tooltip title="Marcar todas como leidas">
          <Button
            size="small"
            type="text"
            icon={<CheckCheck size={15} />}
            loading={markAllAsRead.isPending}
            disabled={unread === 0}
            onClick={() => markAllAsRead.mutate()}
          />
        </Tooltip>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <Empty
            className="py-8"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No tienes notificaciones"
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                className={`!px-4 !py-3 cursor-pointer transition-colors ${
                  item.is_read ? 'bg-white' : 'bg-blue-50/60'
                } hover:bg-slate-50`}
                onClick={() => {
                  if (!item.is_read) markAsRead.mutate(item.id)
                  if (item.link) {
                    setOpen(false)
                    navigate(item.link)
                  }
                }}
                actions={[
                  <Button
                    key="delete"
                    size="small"
                    type="text"
                    icon={<Trash2 size={14} />}
                    onClick={(event) => {
                      event.stopPropagation()
                      remove.mutate(item.id)
                    }}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6} wrap>
                      <span className="text-sm font-medium text-slate-800">{item.title}</span>
                      <Tag color={NOTIFICATION_TYPE[item.type].color} bordered={false}>
                        {NOTIFICATION_TYPE[item.type].label}
                      </Tag>
                      {item.priority === 'CRITICAL' || item.priority === 'HIGH' ? (
                        <Tag color={PRIORITY_LEVEL[item.priority].color} bordered={false}>
                          {PRIORITY_LEVEL[item.priority].label}
                        </Tag>
                      ) : null}
                    </Space>
                  }
                  description={
                    <div className="space-y-1">
                      {item.body ? (
                        <p className="m-0 text-xs text-slate-600 line-clamp-2">{item.body}</p>
                      ) : null}
                      <span className="text-[11px] text-slate-400">
                        {formatRelative(item.created_at)}
                      </span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
      dropdownRender={() => panel}
    >
      <Button type="text" aria-label="Notificaciones">
        <Badge count={unread} size="small" overflowCount={99}>
          <Bell size={19} className="text-slate-600" />
        </Badge>
      </Button>
    </Dropdown>
  )
}
