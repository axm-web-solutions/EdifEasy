import { Alert, Button, Input, Modal, Table, Tag } from 'antd'
import { Download } from 'lucide-react'
import type { OwnerAccountsViewModel } from '../viewmodels/useOwnerAccountsViewModel'

/** Crear cuentas de propietario para las unidades sin propietario de un conjunto. */
export function OwnerAccountsModal({ vm }: { vm: OwnerAccountsViewModel }) {
  return (
    <Modal
      open={vm.open}
      onCancel={vm.close}
      title={`Cuentas de propietarios · ${vm.condominiumName}`}
      width={vm.done ? 760 : 520}
      footer={
        vm.done ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={vm.close}>Cerrar</Button>
            <Button type="primary" icon={<Download size={16} />} onClick={vm.download}>
              Descargar credenciales (CSV)
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={vm.close} disabled={vm.creating}>
              Cancelar
            </Button>
            <Button
              type="primary"
              loading={vm.creating}
              disabled={!vm.slugValid}
              onClick={vm.create}
            >
              {vm.creating ? 'Creando cuentas...' : 'Crear cuentas'}
            </Button>
          </div>
        )
      }
    >
      {vm.done ? (
        <>
          <Alert
            type="success"
            showIcon
            className="mb-3"
            message={`${vm.accounts.length} cuenta(s) creadas`}
            description="Descarga las credenciales ahora: las claves temporales no se vuelven a mostrar. Al ingresar, cada propietario debe aceptar los terminos y puede cambiar su clave."
          />
          <Table
            size="small"
            rowKey="email"
            dataSource={vm.accounts}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 560 }}
            columns={[
              { title: 'Unidad', dataIndex: 'unit' },
              { title: 'Correo', dataIndex: 'email' },
              {
                title: 'Clave temporal',
                dataIndex: 'password',
                render: (password: string | null) =>
                  password ? <code>{password}</code> : <Tag>Cuenta existente</Tag>,
              },
            ]}
          />
        </>
      ) : (
        <div className="space-y-3">
          <p className="m-0 text-sm text-slate-600">
            Se crea una cuenta de propietario por cada casa o apartamento que aun no tiene
            propietario. Si la unidad tiene un residente de referencia (por ejemplo "Propietario
            Casa 07"), se le asigna la cuenta.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">
              Identificador para los correos
            </span>
            <Input
              value={vm.slug}
              onChange={(event) => vm.setSlug(event.target.value)}
              maxLength={30}
            />
          </label>
          <p className="m-0 text-xs text-slate-500">Ejemplo: {vm.example}</p>
          {vm.error ? <Alert type="error" showIcon message={vm.error} /> : null}
        </div>
      )}
    </Modal>
  )
}
