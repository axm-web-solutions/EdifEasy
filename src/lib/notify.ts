import { App } from 'antd'
import type { MessageInstance } from 'antd/es/message/interface'
import type { NotificationInstance } from 'antd/es/notification/interface'

/**
 * Puente entre la API estatica (`notify.success(...)`, usable desde servicios y
 * hooks) y las instancias contextuales de Ant Design, que respetan el tema y el
 * ConfigProvider. `NotifyBridge` se monta una sola vez dentro de `<App />`.
 */
let messageApi: MessageInstance | null = null
let notificationApi: NotificationInstance | null = null

export function NotifyBridge(): null {
  const staticFunction = App.useApp()
  messageApi = staticFunction.message
  notificationApi = staticFunction.notification
  return null
}

export const notify = {
  success(content: string): void {
    void messageApi?.success(content)
  },
  error(content: string): void {
    void messageApi?.error(content)
  },
  info(content: string): void {
    void messageApi?.info(content)
  },
  warning(content: string): void {
    void messageApi?.warning(content)
  },
  loading(content: string): void {
    void messageApi?.loading(content)
  },
  alert(options: { title: string; description?: string; type?: 'info' | 'warning' | 'error' | 'success' }): void {
    notificationApi?.open({
      message: options.title,
      description: options.description,
      type: options.type ?? 'info',
      placement: 'topRight',
      duration: options.type === 'error' ? 8 : 5,
    })
  },
}
