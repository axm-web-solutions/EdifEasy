import { Alert, Button, Card, Divider, Modal, Skeleton } from 'antd'
import { Handshake, Landmark, Pencil, Plus, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  DateField,
  NumberField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import {
  useAgreementsViewModel,
  type AgreementsViewModel,
} from '../viewmodels/useAgreementsViewModel'

function AgreementForm({ vm }: { vm: AgreementsViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title={vm.isEditing ? 'Editar mandato' : 'Nuevo mandato de administracion'}
      description="Lo que cobras por administrar la propiedad y a donde le giras al propietario."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      width={600}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <SelectField
          control={vm.control}
          name="property_id"
          label="Propiedad"
          required
          disabled={vm.isEditing}
          options={vm.propertyOptions}
        />
        <Divider className="!my-2" orientation="left" plain>
          Propietario
        </Divider>
        <SelectField
          control={vm.control}
          name="owner_profile_id"
          label="Propietario con cuenta"
          allowClear
          options={vm.ownerOptions}
          onChangeExtra={vm.onOwnerChange}
          help="Con cuenta ve sus liquidaciones y aprueba gastos desde la app."
        />
        <TextField control={vm.control} name="owner_name" label="Nombre" required />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <SelectField
            control={vm.control}
            name="owner_document_type"
            label="Tipo de documento"
            options={vm.documentTypes}
          />
          <TextField control={vm.control} name="owner_document" label="Numero" />
          <TextField control={vm.control} name="owner_phone" label="Telefono" />
          <TextField control={vm.control} name="owner_email" label="Correo" />
        </div>
        <Divider className="!my-2" orientation="left" plain>
          Comision
        </Divider>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <NumberField
            control={vm.control}
            name="commission_pct"
            label="Comision (%)"
            required
            min={0}
            max={30}
            step={0.5}
            help="Lo usual: 8 a 12 %."
          />
          <SwitchField control={vm.control} name="charges_vat" label="Cobra IVA" />
          {vm.showVat ? (
            <NumberField control={vm.control} name="vat_pct" label="IVA (%)" min={0} max={30} />
          ) : null}
        </div>
        <NumberField
          control={vm.control}
          name="withholding_pct"
          label="Retencion en la fuente (%)"
          min={0}
          max={20}
          step={0.5}
          help="Solo si eres agente retenedor (en general 3,5 % sobre arrendamientos). Validalo con tu contador."
        />
        {vm.formPreview ? (
          <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="m-0 mb-1 text-xs font-medium text-slate-500">
              Asi quedaria la liquidacion de un mes
            </p>
            {vm.formPreview.map((line) => (
              <div
                key={line.label}
                className={`flex justify-between ${line.strong ? 'mt-1 border-t border-slate-200 pt-1 font-semibold text-slate-900' : 'text-slate-600'}`}
              >
                <span>{line.label}</span>
                <span>{line.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        <Divider className="!my-2" orientation="left" plain>
          Cuenta para girarle
        </Divider>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField control={vm.control} name="bank_name" label="Banco" />
          <SelectField
            control={vm.control}
            name="account_type"
            label="Tipo de cuenta"
            options={vm.accountTypes}
          />
          <TextField control={vm.control} name="account_number" label="Numero de cuenta" />
          <TextField control={vm.control} name="account_holder" label="Titular" />
        </div>
        <DateField control={vm.control} name="start_date" label="Vigente desde" required />
        <TextAreaField control={vm.control} name="notes" label="Notas" rows={2} maxLength={1000} />
      </form>
    </FormDrawer>
  )
}

export function AgreementsPage() {
  const vm = useAgreementsViewModel()
  return (
    <div>
      <PageHeader
        title="Propietarios"
        subtitle="El mandato de cada propiedad: tu comision y la cuenta para girarle al dueno."
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => vm.openNew()}>
            Nuevo mandato
          </Button>
        }
      />
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Aun no hay propiedades en arriendo"
          description="Crea propiedades en arriendo y luego registra el mandato con su propietario."
        />
      ) : (
        <div className="space-y-5">
          {vm.missing.length ? (
            <Alert
              type="warning"
              showIcon
              message={`${vm.missing.length} propiedades en arriendo sin mandato`}
              description={
                <div className="mt-1 flex flex-wrap gap-2">
                  {vm.missing.map((property) => (
                    <Button
                      key={property.id}
                      size="small"
                      icon={<Plus size={14} />}
                      onClick={() => vm.openNew(property.id)}
                    >
                      {property.title}
                    </Button>
                  ))}
                </div>
              }
            />
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {vm.agreements.map((item) => (
              <Card
                key={item.id}
                size="small"
                className="surface-card"
                styles={{ body: { padding: 14 } }}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-text">
                    <Handshake size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-semibold text-slate-900">
                      {item.property}
                    </p>
                    <p className="m-0 flex items-center gap-1 text-sm text-slate-700">
                      {item.owner}
                      {item.hasAccount ? (
                        <UserCheck
                          size={14}
                          className="text-emerald-600"
                          aria-label="Con cuenta en la app"
                        />
                      ) : null}
                    </p>
                    {item.document ? (
                      <p className="m-0 text-xs text-slate-500">{item.document}</p>
                    ) : null}
                    <p className="m-0 mt-1 text-xs text-slate-600">{item.terms}</p>
                    {item.bank ? (
                      <p className="m-0 flex items-center gap-1 text-xs text-slate-500">
                        <Landmark size={12} /> {item.bank}
                      </p>
                    ) : (
                      <p className="m-0 text-xs text-amber-600">Falta la cuenta para girarle</p>
                    )}
                    {item.preview ? (
                      <p className="m-0 mt-1 text-xs text-slate-500">{item.preview}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="small"
                    icon={<Pencil size={14} />}
                    onClick={() => vm.openEdit(item.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      Modal.confirm({
                        title: 'Terminar mandato',
                        content:
                          'Ya no se generaran liquidaciones para esta propiedad. Las anteriores se conservan.',
                        okText: 'Terminar',
                        okButtonProps: { danger: true },
                        cancelText: 'Volver',
                        onOk: () => vm.endAgreement(item.id),
                      })
                    }
                  >
                    Terminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      <AgreementForm vm={vm} />
    </div>
  )
}
