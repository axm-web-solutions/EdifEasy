import { Alert, Button, Card, Col, Input, List, Radio, Row, Skeleton, Tag } from 'antd'
import { Save } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { LegalLinks } from '../components/LegalLinks'
import { useComplianceViewModel } from '../viewmodels/useComplianceViewModel'

/** Cumplimiento legal de la plataforma (SUPER_ADMIN). */
export function CompliancePage() {
  const vm = useComplianceViewModel()

  return (
    <>
      <PageHeader
        title="Cumplimiento legal"
        subtitle="Datos del operador para los documentos legales y solicitudes de titulares (Ley 1581 de 2012)."
        breadcrumbs={[{ label: 'Plataforma', to: '/platform' }, { label: 'Cumplimiento' }]}
        dataTour="page-header"
      />

      {vm.missing.length > 0 && !vm.loading ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="Los documentos legales aun no estan completos"
          description={`Falta: ${vm.missing.join(', ')}. Mientras tanto, los textos publicos muestran "[pendiente]".`}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card
            className="surface-card"
            title={<span className="text-sm font-semibold">Datos del operador</span>}
          >
            {vm.loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <div className="space-y-3">
                {vm.fields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-sm text-slate-700">{field.label}</span>
                    <Input
                      value={field.value}
                      placeholder={field.placeholder}
                      maxLength={200}
                      onChange={(event) => vm.setField(field.key, event.target.value)}
                    />
                  </label>
                ))}
                <div>
                  <span className="mb-1 block text-sm text-slate-700">Regimen de IVA</span>
                  <Radio.Group
                    value={vm.vatResponsible}
                    onChange={(event) => vm.setVatResponsible(event.target.value as boolean)}
                    options={[
                      { value: true, label: 'Responsable de IVA (precios con IVA incluido)' },
                      { value: false, label: 'No responsable de IVA' },
                    ]}
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">
                    Confirmalo con tu contador. Se muestra junto a los precios de los planes.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <LegalLinks />
                  <Button
                    type="primary"
                    icon={<Save size={16} />}
                    loading={vm.saving}
                    onClick={vm.save}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card
            className="surface-card"
            title={
              <span className="text-sm font-semibold">
                Solicitudes de titulares
                {vm.openCount ? ` · ${vm.openCount} abiertas` : ''}
              </span>
            }
            extra={vm.overdueCount ? <Tag color="red">{vm.overdueCount} vencida(s)</Tag> : null}
          >
            <List
              loading={vm.requestsLoading}
              dataSource={vm.requests}
              locale={{ emptyText: 'Sin solicitudes' }}
              renderItem={(item) => (
                <List.Item>
                  <div className="w-full">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{item.typeLabel}</span>
                      <span className="flex gap-1">
                        {item.overdue ? (
                          <Tag color="red" className="!m-0">
                            Vencida
                          </Tag>
                        ) : null}
                        <Tag color={item.statusColor} className="!m-0">
                          {item.statusLabel}
                        </Tag>
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.email} · radicada {item.created} · vence {item.due}
                    </div>
                    {item.details ? (
                      <p className="m-0 mt-1 text-sm text-slate-700">{item.details}</p>
                    ) : null}
                    {item.response ? (
                      <p className="m-0 mt-1 text-sm text-slate-500">Respuesta: {item.response}</p>
                    ) : null}

                    {item.open && vm.answering !== item.id ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="small" onClick={() => vm.startAnswer(item.id)}>
                          Responder
                        </Button>
                        <Button size="small" onClick={() => vm.resolve(item.id, 'IN_PROGRESS')}>
                          Marcar en tramite
                        </Button>
                      </div>
                    ) : null}
                    {vm.answering === item.id ? (
                      <div className="mt-2 space-y-2">
                        <Input.TextArea
                          rows={3}
                          maxLength={4000}
                          value={vm.response}
                          onChange={(event) => vm.setResponse(event.target.value)}
                          placeholder="Respuesta al titular (le llega como notificacion)"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="small" onClick={vm.cancelAnswer}>
                            Cancelar
                          </Button>
                          <Button
                            size="small"
                            danger
                            loading={vm.resolving}
                            onClick={() => vm.resolve(item.id, 'REJECTED')}
                          >
                            No procede
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            loading={vm.resolving}
                            onClick={() => vm.resolve(item.id, 'RESOLVED')}
                          >
                            Responder y cerrar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
