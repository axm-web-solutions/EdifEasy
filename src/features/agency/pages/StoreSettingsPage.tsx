import { Alert, Button, Card, Skeleton, Tag, Typography } from 'antd'
import { CheckCircle2, Copy, ExternalLink, Unplug } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { TextAreaField, TextField } from '@/components/forms/fields'
import { useStoreSettingsViewModel } from '../viewmodels/useStoreSettingsViewModel'

const { Paragraph } = Typography

export function StoreSettingsPage() {
  const vm = useStoreSettingsViewModel()

  return (
    <div>
      <PageHeader
        title="Tienda y pagos en linea"
        subtitle="Tu vitrina publica de propiedades y la cuenta donde recibes los pagos del arriendo."
        dataTour="agency-store"
      />
      {vm.loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="surface-card" title="Tienda publica">
            <form onSubmit={vm.saveStore} noValidate>
              {vm.storeError ? (
                <Alert type="error" showIcon message={vm.storeError} className="!mb-4" />
              ) : null}
              {vm.publicUrl ? (
                <div className="mb-4 rounded-lg bg-slate-50 p-3">
                  <p className="m-0 text-xs text-slate-500">Tu tienda esta en</p>
                  <Paragraph
                    copyable={{ text: vm.publicUrl, icon: <Copy size={14} /> }}
                    className="!mb-1 break-all font-medium"
                  >
                    {vm.publicUrl}
                  </Paragraph>
                  <Button
                    size="small"
                    icon={<ExternalLink size={14} />}
                    href={vm.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir tienda
                  </Button>
                </div>
              ) : null}
              <TextField
                control={vm.storeControl}
                name="slug"
                label="Enlace de la tienda"
                required
                prefix="/i/"
                help="Solo minusculas, numeros y guiones. Ej: inmobiliaria-sol"
              />
              <TextAreaField
                control={vm.storeControl}
                name="description"
                label="Presentacion"
                rows={3}
                maxLength={1000}
                placeholder="Quienes son, en que zonas trabajan, horario de atencion..."
              />
              <div className="grid gap-x-4 sm:grid-cols-3">
                <TextField
                  control={vm.storeControl}
                  name="whatsapp"
                  label="WhatsApp"
                  placeholder="3001234567"
                />
                <TextField control={vm.storeControl} name="phone" label="Telefono" />
                <TextField control={vm.storeControl} name="email" label="Correo" />
              </div>
              <Button type="primary" htmlType="submit" loading={vm.savingStore}>
                Guardar tienda
              </Button>
            </form>
          </Card>

          <Card className="surface-card" title="Pagos en linea (Wompi)">
            {vm.account ? (
              <div className="space-y-3">
                <p className="m-0 flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={18} /> Cuenta conectada
                </p>
                <p className="m-0 text-sm text-slate-700">
                  Llave publica {vm.account.publicKey} ·{' '}
                  <Tag color={vm.account.isSandbox ? 'gold' : 'green'} bordered={false}>
                    {vm.account.environment}
                  </Tag>
                </p>
                <p className="m-0 text-xs text-slate-500">Conectada el {vm.account.connectedAt}</p>
                {vm.account.isSandbox ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Estas en modo de pruebas: los pagos no son reales."
                  />
                ) : null}
                <Button
                  danger
                  icon={<Unplug size={16} />}
                  onClick={async () => {
                    if (
                      await confirmDelete({
                        title: 'Desconectar cuenta Wompi',
                        content:
                          'Los arrendatarios no podran pagar en linea hasta que conectes una cuenta.',
                        okText: 'Desconectar',
                      })
                    )
                      vm.disconnect()
                  }}
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <form onSubmit={vm.connect} noValidate>
                <p className="mt-0 text-sm text-slate-700">
                  El dinero de los arriendos llega directo a tu cuenta Wompi. Copia las llaves desde
                  tu panel de Wompi (Desarrolladores → Llaves del API). Los secretos se guardan en
                  el servidor y no se vuelven a mostrar.
                </p>
                {vm.connectError ? (
                  <Alert type="error" showIcon message={vm.connectError} className="!mb-4" />
                ) : null}
                <TextField
                  control={vm.accountControl}
                  name="public_key"
                  label="Llave publica"
                  required
                  placeholder="pub_prod_..."
                />
                <TextField
                  control={vm.accountControl}
                  name="integrity_secret"
                  label="Secreto de integridad"
                  required
                  type="password"
                />
                <TextField
                  control={vm.accountControl}
                  name="events_secret"
                  label="Secreto de eventos"
                  required
                  type="password"
                />
                <Button type="primary" htmlType="submit" loading={vm.connecting}>
                  Conectar cuenta
                </Button>
              </form>
            )}
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="m-0 text-xs font-semibold text-slate-600">Ultimo paso en Wompi</p>
              <p className="m-0 text-xs text-slate-600">
                En tu panel de Wompi (Desarrolladores → URL de eventos) registra esta direccion para
                que los pagos se confirmen solos:
              </p>
              <Paragraph
                copyable={{ text: vm.webhookUrl, icon: <Copy size={14} /> }}
                className="!mb-0 break-all font-mono text-xs"
              >
                {vm.webhookUrl}
              </Paragraph>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
