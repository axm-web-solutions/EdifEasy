import { Alert, Button, Card, Input, Modal, Radio, Select, Tag, Upload } from 'antd'
import { Download, Link2, PlugZap, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { confirmDelete } from '@/components/ui/FormDrawer'
import type { AccountingImportKind, AccountingProvider } from '@/types/database'
import {
  useAccountingConnectionsViewModel,
  type AccountingConnectionsViewModel,
} from '../viewmodels/useAccountingConnectionsViewModel'

function ConnectModal({ vm }: { vm: AccountingConnectionsViewModel }) {
  return (
    <Modal
      open={vm.connectOpen}
      title="Conectar sistema contable"
      onCancel={vm.closeConnect}
      onOk={vm.connect}
      okText="Conectar y sincronizar"
      cancelText="Cancelar"
      okButtonProps={{ disabled: !vm.connectReady }}
      confirmLoading={vm.connecting}
      destroyOnClose
    >
      <div className="space-y-4">
        <Radio.Group
          value={vm.provider}
          onChange={(event) => vm.setProvider(event.target.value)}
          optionType="button"
          buttonStyle="solid"
          options={vm.apiProviders.map((p) => ({ value: p.value, label: p.label }))}
        />
        {vm.fields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-sm text-slate-700">{field.label}</span>
            {field.type === 'password' ? (
              <Input.Password
                value={vm.credentials[field.key] ?? ''}
                onChange={(event) => vm.setCredential(field.key, event.target.value)}
                autoComplete="off"
              />
            ) : (
              <Input
                value={vm.credentials[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => vm.setCredential(field.key, event.target.value)}
                autoComplete="off"
              />
            )}
          </label>
        ))}
        <div>
          <span className="mb-1 block text-sm text-slate-700">
            Como se identifica cada unidad en la contabilidad
          </span>
          <Radio.Group
            value={vm.matchBy}
            onChange={(event) => vm.setMatchBy(event.target.value)}
            className="flex flex-col gap-1"
          >
            <Radio value="CODE_IN_NAME">
              Por el codigo en el nombre del cliente (ej. "T1-301 Ana Perez")
            </Radio>
            <Radio value="IDENTIFICATION">
              Por el documento del propietario (lo enlazas una vez con su unidad)
            </Radio>
          </Radio.Group>
        </div>
        <p className="m-0 text-xs text-slate-500">
          Las credenciales quedan en el servidor, en un lugar que la app no puede leer, y no se
          vuelven a mostrar. Se sincronizan los ultimos 12 meses de facturas y pagos.
        </p>
        {vm.connectError ? <Alert type="error" showIcon message={vm.connectError} /> : null}
      </div>
    </Modal>
  )
}

/** Pestana "Conexion contable" (solo administracion). */
export function ConnectionsPanel() {
  const vm = useAccountingConnectionsViewModel(true)

  return (
    <div className="space-y-5">
      <Card
        className="surface-card"
        title="Sistemas conectados"
        extra={
          <Button type="primary" icon={<PlugZap size={16} />} onClick={vm.openConnect}>
            Conectar Siigo o Alegra
          </Button>
        }
      >
        {vm.integrations.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">
            Aun no hay conexiones. Conecta Siigo o Alegra para sincronizar automaticamente, o carga
            un archivo de cualquier otro programa abajo.
          </p>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.integrations.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                    <Tag color={item.statusColor} bordered={false} className="!m-0">
                      {item.statusLabel}
                    </Tag>
                  </div>
                  <p className="m-0 text-xs text-slate-500">
                    {item.modeLabel} · {item.lastSyncLabel}
                  </p>
                  {item.error ? <p className="m-0 text-xs text-red-600">{item.error}</p> : null}
                </div>
                <div className="flex gap-2">
                  {item.mode === 'API' ? (
                    <Button
                      size="small"
                      icon={<RefreshCw size={14} />}
                      loading={vm.syncing === item.id}
                      onClick={() => vm.sync(item.id)}
                    >
                      Sincronizar ahora
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    aria-label={`Quitar ${item.label}`}
                    onClick={async () => {
                      if (
                        await confirmDelete({
                          title: `Quitar ${item.label}`,
                          content:
                            'La informacion ya cargada se conserva. Se borran las credenciales.',
                          okText: 'Quitar',
                        })
                      )
                        vm.disconnect(item.id, item.mode)
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {vm.syncError ? (
          <Alert type="error" showIcon message={vm.syncError} className="!mt-3" />
        ) : null}
      </Card>

      <Card
        className="surface-card"
        title="Cargar archivo (World Office, Helisa, ContaPyme, Excel...)"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Programa de origen</span>
            <Select
              className="w-full"
              value={vm.fileProvider}
              onChange={(value: AccountingProvider) => vm.setFileProvider(value)}
              options={vm.fileProviders.map((p) => ({ value: p.value, label: p.label }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Que informacion trae</span>
            <Select
              className="w-full"
              value={vm.importKind}
              onChange={(value: AccountingImportKind) => vm.setImportKind(value)}
              options={vm.kindOptions}
            />
          </label>
        </div>
        <p className="m-0 mt-2 text-xs text-slate-500">{vm.kindDescription}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button icon={<Download size={16} />} onClick={vm.downloadTemplate}>
            Descargar plantilla
          </Button>
          <Upload
            accept=".csv,.txt"
            showUploadList={false}
            beforeUpload={(file) => {
              vm.readFile(file)
              return false
            }}
          >
            <Button icon={<UploadCloud size={16} />}>
              {vm.fileName ? 'Cambiar archivo' : 'Elegir archivo CSV'}
            </Button>
          </Upload>
        </div>

        {vm.fileName ? (
          <p className="m-0 mt-2 text-sm text-slate-700">Archivo: {vm.fileName}</p>
        ) : null}
        {vm.fileError ? (
          <Alert type="warning" showIcon message={vm.fileError} className="!mt-3" />
        ) : null}
        {vm.preview ? (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {vm.preview.rows} filas listas · columnas reconocidas: {vm.preview.columns.join(', ')}
            <div className="mt-2">
              <Button type="primary" loading={vm.importing} onClick={vm.importFile}>
                Importar
              </Button>
            </div>
          </div>
        ) : null}
        {vm.importError ? (
          <Alert type="error" showIcon message={vm.importError} className="!mt-3" />
        ) : null}

        {vm.result ? (
          <Alert
            className="!mt-3"
            type={vm.result.unmatched.length ? 'warning' : 'success'}
            showIcon
            message={`${vm.result.imported} registros importados${vm.result.skipped ? `, ${vm.result.skipped} omitidos` : ''}`}
            description={
              vm.result.unmatched.length ? (
                <div className="space-y-2">
                  <p className="m-0">
                    Estos codigos no coinciden con ninguna unidad. Enlazalos una vez y vuelve a
                    importar:
                  </p>
                  {vm.result.unmatched.slice(0, 30).map((code) => (
                    <div key={code} className="flex flex-wrap items-center gap-2">
                      <Tag className="!m-0">{code}</Tag>
                      <Select
                        className="min-w-0 flex-1 sm:max-w-xs"
                        size="small"
                        showSearch
                        optionFilterProp="label"
                        placeholder="Unidad"
                        value={vm.links[code]}
                        onChange={(value: string) => vm.setLink(code, value)}
                        options={vm.unitOptions}
                      />
                      <Button
                        size="small"
                        icon={<Link2 size={14} />}
                        disabled={!vm.links[code]}
                        loading={vm.linking === code}
                        onClick={() => vm.saveLink(code)}
                      >
                        Enlazar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                'Los propietarios ya ven la informacion actualizada.'
              )
            }
          />
        ) : null}
      </Card>

      <Card className="surface-card" title="Ultimas cargas">
        {vm.runs.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">Todavia no hay cargas.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Tag color={run.statusColor} bordered={false} className="!m-0">
                  {run.statusLabel}
                </Tag>
                <span className="font-medium text-slate-800">{run.label}</span>
                <span className="text-slate-500">
                  {run.source} · {run.detail} · {run.when}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConnectModal vm={vm} />
    </div>
  )
}
