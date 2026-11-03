import { Button, Card, Segmented, Select, Skeleton, Tag } from 'antd'
import { MessageCircle, Phone } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import type { AgencyLeadRow } from '@/types/database'
import { useLeadsViewModel } from '../viewmodels/useLeadsViewModel'

export function LeadsPage() {
  const vm = useLeadsViewModel()
  return (
    <div>
      <PageHeader
        title="Interesados"
        subtitle="Personas que dejaron sus datos en tu tienda. Contactalas por WhatsApp o llamada."
        dataTour="agency-leads"
      />
      <div className="mb-4 max-w-full overflow-x-auto">
        <Segmented
          value={vm.filter}
          onChange={(value) => vm.setFilter(value as AgencyLeadRow['status'] | 'ALL')}
          options={vm.filterOptions}
        />
      </div>
      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.leads.length === 0 ? (
        <EmptyState
          title="Sin interesados"
          description="Cuando alguien deje sus datos en tu tienda, aparecera aqui."
        />
      ) : (
        <Card className="surface-card" styles={{ body: { padding: 0 } }}>
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.leads.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{lead.name}</span>
                    <Tag color={lead.statusColor} bordered={false} className="!m-0">
                      {lead.statusLabel}
                    </Tag>
                    <span className="text-xs text-slate-400">{lead.when}</span>
                  </div>
                  <p className="m-0 text-xs text-slate-600">
                    {lead.phone}
                    {lead.email ? ` · ${lead.email}` : ''}
                    {lead.property ? ` · por "${lead.property}"` : ''}
                  </p>
                  {lead.message ? (
                    <p className="m-0 mt-1 text-sm text-slate-700">“{lead.message}”</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.whatsapp ? (
                    <Button
                      size="small"
                      icon={<MessageCircle size={14} />}
                      href={lead.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </Button>
                  ) : null}
                  {lead.call ? (
                    <Button size="small" icon={<Phone size={14} />} href={lead.call}>
                      Llamar
                    </Button>
                  ) : null}
                  <Select
                    size="small"
                    className="w-36"
                    value={lead.status}
                    onChange={(value: AgencyLeadRow['status']) => vm.setStatus(lead.id, value)}
                    options={[
                      { value: 'NEW', label: 'Nuevo' },
                      { value: 'CONTACTED', label: 'Contactado' },
                      { value: 'CLOSED', label: 'Cerrado' },
                    ]}
                    aria-label="Estado del interesado"
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
