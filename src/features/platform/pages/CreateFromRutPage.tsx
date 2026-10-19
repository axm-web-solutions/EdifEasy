import { Alert, Button, Card, Steps, Table, Tag, Upload } from 'antd'
import { Download, FileText, RefreshCw, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { formatNumber } from '@/utils/format'
import { useCreateFromRutViewModel } from '../viewmodels/useCreateFromRutViewModel'

const STEP_INDEX = { upload: 0, review: 1, done: 2 } as const

/** Alta de un conjunto con solo el RUT (super administrador). */
export function CreateFromRutPage() {
  const vm = useCreateFromRutViewModel()

  return (
    <>
      <PageHeader
        title="Nuevo conjunto desde el RUT"
        subtitle="Sube el RUT en PDF: se llenan los datos, el representante legal queda como administrador y se crea una cuenta por unidad."
        breadcrumbs={[{ label: 'Plataforma', to: '/platform' }, { label: 'Nuevo conjunto' }]}
      />

      <Steps
        size="small"
        current={STEP_INDEX[vm.step]}
        className="mb-4"
        items={[{ title: 'RUT' }, { title: 'Datos y unidades' }, { title: 'Credenciales' }]}
        responsive={false}
      />

      {vm.step === 'upload' ? (
        <Card className="surface-card" data-tour="rut-upload">
          <Upload.Dragger
            accept="application/pdf,.pdf"
            multiple={false}
            showUploadList={false}
            disabled={vm.reading}
            beforeUpload={(file) => {
              vm.readFile(file)
              return false
            }}
          >
            <div className="flex flex-col items-center gap-2 px-4 py-6">
              <UploadCloud size={36} className="text-brand-text" />
              <p className="m-0 text-base font-semibold text-slate-800">
                {vm.reading
                  ? 'Leyendo el RUT...'
                  : 'Arrastra aqui el RUT en PDF o haz clic para elegirlo'}
              </p>
              <p className="m-0 max-w-md text-sm text-slate-500">
                El archivo se lee en tu navegador y no se guarda. No se almacena el documento de
                identidad del representante legal.
              </p>
              {vm.fileName ? (
                <Tag icon={<FileText size={12} className="mr-1 inline" />}>{vm.fileName}</Tag>
              ) : null}
            </div>
          </Upload.Dragger>
          {vm.readError ? (
            <Alert type="error" showIcon className="mt-4" message={vm.readError} />
          ) : null}
          <div className="mt-4 text-center">
            <Button type="link" onClick={vm.fillManually}>
              No tengo el PDF: llenar a mano
            </Button>
          </div>
        </Card>
      ) : null}

      {vm.step === 'review' ? (
        <form onSubmit={vm.submit} noValidate className="space-y-4">
          {vm.readNotice ? (
            <Alert type={vm.readNotice.type} showIcon message={vm.readNotice.text} />
          ) : null}

          <Card
            className="surface-card"
            title={<span className="text-sm font-semibold">Conjunto</span>}
          >
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <TextField control={vm.control} name="name" label="Nombre" required maxLength={150} />
              <TextField
                control={vm.control}
                name="nit"
                label="NIT"
                required
                placeholder="900518186-0"
              />
              <TextField control={vm.control} name="address" label="Direccion" required />
              <TextField control={vm.control} name="city" label="Ciudad o municipio" required />
              <TextField control={vm.control} name="department" label="Departamento" />
              <TextField control={vm.control} name="phone" label="Telefono" />
              <TextField control={vm.control} name="email" label="Correo del conjunto" />
            </div>
          </Card>

          <Card
            className="surface-card"
            title={
              <span className="text-sm font-semibold">Administrador (representante legal)</span>
            }
          >
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <TextField control={vm.control} name="admin_name" label="Nombre completo" required />
              <TextField
                control={vm.control}
                name="admin_email"
                label="Correo para ingresar"
                required
                help="Es su usuario. Si ya tiene cuenta en EdiFeasy, se le asigna el conjunto sin cambiar su clave."
              />
            </div>
          </Card>

          <Card
            className="surface-card"
            title={<span className="text-sm font-semibold">Unidades</span>}
          >
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-4">
              <SelectField
                control={vm.control}
                name="kind"
                label="Tipo"
                required
                options={vm.kindOptions}
              />
              {vm.kind === 'HOUSES' ? (
                <NumberField
                  control={vm.control}
                  name="houses"
                  label="Numero de casas"
                  required
                  min={1}
                  max={2000}
                />
              ) : (
                <>
                  <NumberField
                    control={vm.control}
                    name="towers"
                    label="Torres"
                    required
                    min={1}
                    max={60}
                  />
                  <NumberField
                    control={vm.control}
                    name="floors"
                    label="Pisos por torre"
                    required
                    min={1}
                    max={60}
                  />
                  <NumberField
                    control={vm.control}
                    name="units_per_floor"
                    label="Aptos por piso"
                    required
                    min={1}
                    max={30}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 items-start gap-x-4 md:grid-cols-2">
              <TextField
                control={vm.control}
                name="email_slug"
                label="Identificador para los correos"
                required
                help={`Cada unidad recibe un correo como ${vm.sampleUnits[0]?.email ?? `01.conjunto@${vm.emailDomain}`}`}
              />
              <div className="pt-0 md:pt-7">
                <Button icon={<RefreshCw size={14} />} onClick={vm.regenerateSlug}>
                  Generar desde el nombre
                </Button>
              </div>
            </div>

            {vm.tooManyUnits ? (
              <Alert type="error" showIcon message="Maximo 3000 unidades por alta." />
            ) : vm.unitTotal > 0 ? (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p className="m-0 font-medium">
                  Se crearan {formatNumber(vm.unitTotal)} unidad(es), cada una con su cuenta de
                  propietario:
                </p>
                <ul className="m-0 mt-2 list-none space-y-1 p-0">
                  {vm.sampleUnits.map((unit, index) => (
                    <li key={unit.email} className="flex flex-wrap gap-x-2">
                      {index === 2 && vm.unitTotal > 3 ? (
                        <span className="w-full text-slate-400">...</span>
                      ) : null}
                      <span className="font-medium">{unit.label}</span>
                      <span className="break-all text-slate-500">{unit.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {vm.submitError ? <Alert type="error" showIcon message={vm.submitError} /> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={vm.backToUpload} disabled={vm.submitting}>
              Volver
            </Button>
            <Button type="primary" htmlType="submit" loading={vm.submitting}>
              {vm.submitting ? 'Creando conjunto y cuentas...' : 'Crear conjunto'}
            </Button>
          </div>
        </form>
      ) : null}

      {vm.step === 'done' ? (
        <Card className="surface-card">
          <Alert
            type="success"
            showIcon
            message={`${vm.condominiumName} quedo creado con ${formatNumber(vm.accounts.length - 1)} cuenta(s) de propietario.`}
            description="Descarga las credenciales ahora: las claves temporales no se vuelven a mostrar. Pide a cada persona cambiar su clave al ingresar."
          />
          <div className="my-4 flex flex-wrap gap-2">
            <Button type="primary" icon={<Download size={16} />} onClick={vm.downloadCredentials}>
              Descargar credenciales (CSV)
            </Button>
            <Link to="/platform">
              <Button>Ir a Plataforma</Button>
            </Link>
            <Button onClick={vm.startOver}>Crear otro conjunto</Button>
          </div>
          <Table
            size="small"
            rowKey="email"
            dataSource={vm.accounts}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            scroll={{ x: 640 }}
            columns={[
              { title: 'Unidad', dataIndex: 'unit' },
              { title: 'Rol', dataIndex: 'role' },
              { title: 'Correo', dataIndex: 'email' },
              {
                title: 'Clave temporal',
                dataIndex: 'password',
                render: (password: string | null) =>
                  password ? <code>{password}</code> : <Tag>Cuenta existente</Tag>,
              },
            ]}
          />
        </Card>
      ) : null}
    </>
  )
}
