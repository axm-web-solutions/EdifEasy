import { Alert, Button, Select, Switch, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { ErrorState } from '@/components/ui/states'
import type { ModuleMeta } from '@/constants/modules'
import {
  useRoleModulesViewModel,
  type RoleModulesViewModel,
} from '../viewmodels/useRoleModulesViewModel'

function columns(vm: RoleModulesViewModel): ColumnsType<ModuleMeta> {
  return [
    {
      title: 'Modulo',
      key: 'module',
      fixed: 'left',
      width: 220,
      render: (_, module) => (
        <div>
          <p className="m-0 font-medium text-slate-800">{module.label}</p>
          <p className="m-0 text-xs text-slate-500">{module.description}</p>
        </div>
      ),
    },
    ...vm.matrix.roles.map(({ role, label }) => ({
      title: <span className="text-xs">{label}</span>,
      key: role,
      width: 120,
      align: 'center' as const,
      render: (_: unknown, module: ModuleMeta) => {
        const cell = vm.matrix.cell(role, module.key)
        return (
          <Tooltip title={cell.hint}>
            <span
              className={`inline-flex rounded-full p-1 ${cell.customized ? 'ring-2 ring-amber-300' : ''}`}
            >
              <Switch
                checked={cell.enabled}
                loading={cell.saving}
                aria-label={`${module.label} para ${label}`}
                onChange={(checked) => vm.toggle(role, module.key, checked)}
              />
            </span>
          </Tooltip>
        )
      },
    })),
  ]
}

/** Vista de "Modulos por rol": solo dibuja lo que entrega `useRoleModulesViewModel`. */
export function RoleModulesPage() {
  const vm = useRoleModulesViewModel()

  return (
    <>
      <PageHeader
        title="Modulos por rol"
        subtitle="Decide que modulos ve y puede usar cada rol, en la plantilla o en un conjunto especifico."
        dataTour="page-header"
      />

      <SectionCard
        title="Configuracion"
        className="mb-4"
        extra={
          vm.canReset ? (
            <Button
              icon={<RotateCcw size={14} />}
              loading={vm.resetting}
              onClick={() => void vm.reset()}
            >
              Volver a la plantilla
            </Button>
          ) : null
        }
      >
        <label className="block max-w-xl">
          <span className="mb-1 block text-sm text-slate-600">Aplicar a</span>
          <Select
            className="w-full"
            showSearch
            optionFilterProp="label"
            value={vm.scope.value}
            onChange={vm.scope.set}
            options={vm.scope.options}
            loading={vm.scope.loading}
          />
        </label>
        <p className="m-0 mt-3 text-sm text-slate-500">{vm.summary.text}</p>
        <Alert
          className="mt-3"
          type="info"
          showIcon
          message="Desactivar un modulo oculta el menu y bloquea los datos en la base para ese rol. Nunca da acceso a algo que el rol no tenia. El super administrador siempre ve todo."
        />
      </SectionCard>

      <SectionCard title="Matriz de modulos" dataTour="data-table">
        {vm.matrix.error ? (
          <ErrorState
            title="No se pudo cargar la configuracion"
            description={vm.matrix.error}
            onRetry={vm.matrix.retry}
          />
        ) : (
          <>
            <Table<ModuleMeta>
              rowKey="key"
              size="small"
              columns={columns(vm)}
              dataSource={vm.matrix.modules}
              loading={vm.matrix.loading}
              pagination={false}
              scroll={{ x: 220 + vm.matrix.roles.length * 120 }}
            />
            <p className="m-0 mt-3 text-xs text-slate-500">
              Los interruptores con borde amarillo tienen un ajuste propio; los demas heredan la
              plantilla o estan sin configurar (habilitados).
            </p>
          </>
        )}
      </SectionCard>
    </>
  )
}
