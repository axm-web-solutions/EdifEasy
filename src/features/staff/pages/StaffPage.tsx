import { Alert, Button, Card, Segmented, Skeleton, Tabs, Tag } from 'antd'
import { Clock, LogIn, LogOut, Phone, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormDrawer } from '@/components/ui/FormDrawer'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { useStaffViewModel, type StaffViewModel } from '../viewmodels/useStaffViewModel'

function SelfCard({ vm }: { vm: StaffViewModel }) {
  return (
    <Card className="surface-card !mb-4" data-tour="staff-self">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              vm.myShift ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Clock size={20} />
          </span>
          <div>
            <p className="m-0 text-sm font-semibold text-slate-800">
              {vm.myShift ? `En turno desde las ${vm.myShift.since}` : 'No has marcado ingreso hoy'}
            </p>
            <p className="m-0 text-xs text-slate-500">
              {vm.myShift
                ? `Llevas ${vm.myShift.duration}. Marca la salida al terminar.`
                : 'Marca tu ingreso al llegar al conjunto.'}
            </p>
          </div>
        </div>
        {vm.myShift ? (
          <Button
            size="large"
            icon={<LogOut size={18} />}
            loading={vm.checkingOut === vm.myShift.id}
            onClick={() => vm.myShift && vm.checkOut(vm.myShift.id)}
          >
            Marcar salida
          </Button>
        ) : (
          <Button
            size="large"
            type="primary"
            icon={<LogIn size={18} />}
            loading={vm.checkingIn}
            onClick={vm.checkInSelf}
          >
            Marcar ingreso
          </Button>
        )}
      </div>
    </Card>
  )
}

function Board({ vm }: { vm: StaffViewModel }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        className="surface-card"
        title={`En turno (${vm.onDuty.length})`}
        styles={{ body: { padding: 0 } }}
      >
        {vm.onDuty.length === 0 ? (
          <p className="m-0 p-4 text-sm text-slate-500">Nadie ha marcado ingreso todavia.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.onDuty.map((person) => (
              <li key={person.key} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-slate-800">
                    {person.name}{' '}
                    {person.external ? (
                      <Tag bordered={false} className="!ml-1">
                        Externo
                      </Tag>
                    ) : null}
                  </p>
                  <p className="m-0 text-xs text-slate-500">
                    {person.roleLabel} · desde {person.since} · {person.duration}
                  </p>
                </div>
                {vm.canManage ? (
                  <Button
                    size="small"
                    icon={<LogOut size={14} />}
                    loading={vm.checkingOut === person.shiftId}
                    onClick={() => vm.checkOut(person.shiftId)}
                  >
                    Salida
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        className="surface-card"
        title={`No han llegado (${vm.absent.length})`}
        styles={{ body: { padding: 0 } }}
      >
        {vm.absent.length === 0 ? (
          <p className="m-0 p-4 text-sm text-slate-500">Todo el personal esta en turno.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.absent.map((person) => (
              <li key={person.profileId} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-medium text-slate-800">{person.name}</p>
                  <p className="m-0 text-xs text-slate-500">
                    {person.roleLabel} · {person.lastSeen}
                  </p>
                </div>
                {person.phone ? (
                  <Button
                    size="small"
                    type="text"
                    href={`tel:${person.phone}`}
                    icon={<Phone size={14} />}
                    aria-label={`Llamar a ${person.name}`}
                  />
                ) : null}
                {vm.canManage ? (
                  <Button
                    size="small"
                    icon={<LogIn size={14} />}
                    onClick={() => vm.checkInMember(person.profileId)}
                  >
                    Ingreso
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function History({ vm }: { vm: StaffViewModel }) {
  if (vm.history.length === 0) {
    return <EmptyState title="Sin jornadas en los ultimos 7 dias" />
  }
  return (
    <Card className="surface-card" styles={{ body: { padding: 0 } }}>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0">
        {vm.history.map((shift) => (
          <li
            key={shift.id}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-medium text-slate-800">
                {shift.name} <span className="font-normal text-slate-500">· {shift.roleLabel}</span>
              </p>
              {shift.notes ? <p className="m-0 text-xs text-slate-500">{shift.notes}</p> : null}
            </div>
            <p className="m-0 text-xs text-slate-600 sm:text-right">
              {shift.checkIn} → {shift.checkOut}
              <br />
              {shift.open ? (
                <Tag color="green" bordered={false} className="!m-0">
                  En turno · {shift.duration}
                </Tag>
              ) : (
                <span className="text-slate-400">{shift.duration}</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CheckInDrawer({ vm }: { vm: StaffViewModel }) {
  return (
    <FormDrawer
      open={vm.formOpen}
      title="Registrar ingreso"
      description="Para alguien del personal o una persona externa (jardineria, obra, fumigacion)."
      onClose={vm.closeForm}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      submitLabel="Registrar ingreso"
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <Segmented
          block
          className="!mb-4"
          value={vm.mode}
          onChange={(value) => vm.setMode(value as 'member' | 'external')}
          options={[
            { value: 'member', label: 'Del personal' },
            { value: 'external', label: 'Externo' },
          ]}
        />
        {vm.mode === 'member' ? (
          <SelectField
            control={vm.control}
            name="profile_id"
            label="Persona"
            required
            options={vm.memberOptions}
            placeholder="Busca por nombre"
          />
        ) : (
          <>
            <TextField control={vm.control} name="name" label="Nombre completo" required />
            <TextField
              control={vm.control}
              name="role_label"
              label="Labor"
              placeholder="Ej: Jardineria, plomeria, obra"
            />
          </>
        )}
        <TextAreaField
          control={vm.control}
          name="notes"
          label="Observaciones"
          rows={3}
          maxLength={500}
        />
      </form>
    </FormDrawer>
  )
}

export function StaffPage() {
  const vm = useStaffViewModel()

  return (
    <div>
      <PageHeader
        title="Personal"
        subtitle="Quien esta trabajando en el conjunto y a que hora entro o salio."
        dataTour="staff-header"
        actions={
          vm.canManage ? (
            <Button icon={<UserPlus size={16} />} onClick={() => vm.openForm()}>
              Registrar ingreso
            </Button>
          ) : null
        }
      />

      {vm.status === 'loading' ? (
        <Card className="surface-card">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : (
        <>
          {vm.showSelf ? <SelfCard vm={vm} /> : null}
          {vm.canViewBoard ? (
            <Tabs
              items={[
                { key: 'board', label: 'Hoy', children: <Board vm={vm} /> },
                { key: 'history', label: 'Historial', children: <History vm={vm} /> },
              ]}
            />
          ) : (
            <>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Mis jornadas</h3>
              <History vm={vm} />
            </>
          )}
        </>
      )}

      <CheckInDrawer vm={vm} />
    </div>
  )
}
