import type { ReactNode } from 'react'
import { Button, Drawer, Modal, Space } from 'antd'
import { AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'

export function FormDrawer({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitting = false,
  submitLabel = 'Guardar',
  width = 520,
  children,
  footerExtra,
  destroyOnClose = true,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  onSubmit: () => void
  submitting?: boolean
  submitLabel?: string
  width?: number
  children: ReactNode
  footerExtra?: ReactNode
  destroyOnClose?: boolean
}) {
  const isMobile = useIsMobile()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="m-0 font-semibold text-slate-800">{title}</p>
          {description ? <p className="m-0 text-xs text-slate-500">{description}</p> : null}
        </div>
      }
      width={isMobile ? '100%' : width}
      destroyOnClose={destroyOnClose}
      maskClosable={!submitting}
      closable={!submitting}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>{footerExtra}</div>
          <Space>
            <Button onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="primary" loading={submitting} onClick={onSubmit}>
              {submitLabel}
            </Button>
          </Space>
        </div>
      }
    >
      {children}
    </Drawer>
  )
}

/**
 * Confirmacion de borrado. Devuelve una promesa que resuelve `true` si el
 * usuario confirma.
 */
export function confirmDelete(options: {
  title?: string
  content?: string
  okText?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: options.title ?? 'Confirmar eliminacion',
      icon: <AlertTriangle className="text-amber-500" size={20} />,
      content:
        options.content ?? 'Esta accion no se puede deshacer. Deseas continuar con la eliminacion?',
      okText: options.okText ?? 'Eliminar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
