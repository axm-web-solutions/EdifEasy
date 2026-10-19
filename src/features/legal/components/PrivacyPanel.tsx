import { Alert, Button, Card, Col, Empty, Input, List, Row, Select, Tag } from 'antd'
import { Download, Send } from 'lucide-react'
import { usePrivacyViewModel } from '../viewmodels/usePrivacyViewModel'
import { LegalLinks } from './LegalLinks'

/** Pestana "Privacidad y datos" de Configuracion. */
export function PrivacyPanel() {
  const vm = usePrivacyViewModel()

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card
          className="surface-card h-full"
          title={<span className="text-sm font-semibold">Tus datos</span>}
        >
          <p className="mt-0 text-sm text-slate-600">
            Descarga una copia de los datos personales que EdiFeasy tiene sobre ti (perfil,
            apartamentos, solicitudes, reservas, publicaciones, pagos y aceptaciones).
          </p>
          <Button icon={<Download size={16} />} loading={vm.exporting} onClick={vm.exportData}>
            Descargar mis datos
          </Button>

          <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Lo que has aceptado</h4>
          <List
            size="small"
            loading={vm.loadingAcceptances}
            dataSource={vm.acceptances}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin registros" />,
            }}
            renderItem={(item) => (
              <List.Item>
                <span className="text-sm text-slate-700">{item.label}</span>
                <span className="text-xs text-slate-500">
                  v{item.version} · {item.date}
                </span>
              </List.Item>
            )}
          />
          <LegalLinks className="mt-4" />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card
          className="surface-card h-full"
          title={<span className="text-sm font-semibold">Ejercer tus derechos</span>}
        >
          <label className="mb-1 block text-sm text-slate-700" htmlFor="data-request-type">
            Que necesitas
          </label>
          <Select
            id="data-request-type"
            className="w-full"
            value={vm.type}
            onChange={vm.setType}
            options={vm.typeOptions}
          />
          <p className="mb-3 mt-1 text-xs text-slate-500">{vm.typeHint}</p>
          <Input.TextArea
            rows={3}
            maxLength={2000}
            value={vm.details}
            onChange={(event) => vm.setDetails(event.target.value)}
            placeholder="Detalles (opcional)"
            aria-label="Detalles de la solicitud"
          />
          {vm.submitError ? (
            <Alert type="error" showIcon className="mt-3" message={vm.submitError} />
          ) : null}
          <div className="mt-3 flex justify-end">
            <Button
              type="primary"
              icon={<Send size={16} />}
              loading={vm.submitting}
              onClick={vm.submit}
            >
              Radicar solicitud
            </Button>
          </div>

          {vm.requests.length > 0 ? (
            <>
              <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Tus solicitudes</h4>
              <List
                size="small"
                dataSource={vm.requests}
                renderItem={(item) => (
                  <List.Item>
                    <div className="w-full">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">{item.typeLabel}</span>
                        <Tag color={item.statusColor} className="!m-0">
                          {item.statusLabel}
                        </Tag>
                      </div>
                      <div className="text-xs text-slate-500">
                        Radicada el {item.created} · respuesta a mas tardar el {item.due}
                      </div>
                      {item.response ? (
                        <p className="m-0 mt-1 whitespace-pre-line text-sm text-slate-700">
                          {item.response}
                        </p>
                      ) : null}
                    </div>
                  </List.Item>
                )}
              />
            </>
          ) : null}
        </Card>
      </Col>
    </Row>
  )
}
