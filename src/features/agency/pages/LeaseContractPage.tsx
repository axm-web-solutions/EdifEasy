import { Alert, Button, Card, Checkbox, Input, Modal, Result, Skeleton, Tag } from 'antd'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  MessageCircle,
  PenLine,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextField } from '@/components/forms/fields'
import {
  useLeaseContractViewModel,
  type LeaseContractViewModel,
} from '../viewmodels/useLeaseContractViewModel'

function Guarantors({ vm }: { vm: LeaseContractViewModel }) {
  return (
    <Card size="small" className="surface-card" title="Codeudores">
      {vm.guarantors.length ? (
        <ul className="m-0 mb-3 list-none space-y-2 p-0">
          {vm.guarantors.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-slate-900">{item.name}</p>
                {item.detail ? <p className="m-0 text-xs text-slate-500">{item.detail}</p> : null}
              </div>
              {vm.editable ? (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<Trash2 size={14} />}
                  aria-label={`Quitar a ${item.name}`}
                  onClick={() => vm.removeGuarantor(item.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mb-3 text-sm text-slate-500">Sin codeudores.</p>
      )}
      {vm.editable ? (
        <form onSubmit={vm.addGuarantor} noValidate>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <TextField control={vm.guarantorControl} name="name" label="Nombre" required />
            <TextField control={vm.guarantorControl} name="document" label="Documento" />
            <TextField control={vm.guarantorControl} name="phone" label="Telefono" />
            <TextField control={vm.guarantorControl} name="email" label="Correo" />
          </div>
          <Button
            htmlType="submit"
            icon={<UserPlus size={16} />}
            loading={vm.addingGuarantor}
            block
          >
            Agregar codeudor
          </Button>
        </form>
      ) : null}
    </Card>
  )
}

function SendPanel({ vm }: { vm: LeaseContractViewModel }) {
  return (
    <Card size="small" className="surface-card" title="Quienes firman">
      <ul className="m-0 mb-3 list-none space-y-2 p-0">
        {vm.proposedSigners.map((signer) => (
          <li key={signer.key} className="flex items-center gap-2 text-sm">
            <PenLine size={14} className="text-slate-400" />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-900">{signer.name}</span>
              <span className="block text-xs text-slate-500">{signer.role}</span>
            </span>
            {signer.hasAccount ? (
              <UserCheck size={14} className="text-emerald-600" aria-label="Firma desde la app" />
            ) : null}
          </li>
        ))}
      </ul>
      {vm.canIncludeOwner ? (
        <Checkbox
          checked={vm.includeOwner}
          onChange={(event) => vm.setIncludeOwner(event.target.checked)}
          className="!mb-3"
        >
          <span className="text-sm">Que tambien firme el propietario</span>
        </Checkbox>
      ) : null}
      {vm.sendError ? (
        <Alert type="error" showIcon message={vm.sendError} className="!mb-3" />
      ) : null}
      <Button
        type="primary"
        block
        icon={<Send size={16} />}
        loading={vm.sending}
        onClick={() =>
          Modal.confirm({
            title: 'Enviar a firma',
            content:
              'El texto queda congelado y cada firmante recibe su enlace. Si necesitas cambiarlo despues, cancelas la firma y lo vuelves a enviar.',
            okText: 'Enviar',
            cancelText: 'Volver',
            onOk: vm.send,
          })
        }
      >
        Enviar a firma
      </Button>
      <p className="m-0 mt-2 text-xs text-slate-500">
        Firma electronica (Ley 527 de 1999): se guarda el texto con su huella SHA-256, la fecha,
        la IP y el trazo de cada firma.
      </p>
    </Card>
  )
}

function SignersStatus({ vm }: { vm: LeaseContractViewModel }) {
  return (
    <Card
      size="small"
      className="surface-card print:hidden"
      title={`Firmas${vm.progress ? ` (${vm.progress})` : ''}`}
    >
      <ul className="m-0 list-none space-y-3 p-0">
        {vm.signers.map((signer) => (
          <li key={signer.id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-start gap-2">
              {signer.signed ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <Clock size={18} className="mt-0.5 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-slate-900">{signer.name}</p>
                <p className="m-0 text-xs text-slate-500">
                  {signer.role} · {signer.signedLabel}
                </p>
              </div>
            </div>
            {!signer.signed && vm.status === 'SENT' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {signer.isMe ? (
                  <Button
                    size="small"
                    type="primary"
                    icon={<PenLine size={14} />}
                    onClick={() => vm.signNow(signer.id)}
                  >
                    Firmar ahora
                  </Button>
                ) : null}
                <Button
                  size="small"
                  icon={<Copy size={14} />}
                  loading={vm.gettingLink}
                  onClick={() => vm.getLink(signer.id)}
                >
                  {signer.link ? 'Nuevo enlace' : 'Copiar enlace'}
                </Button>
                {signer.whatsapp ? (
                  <Button
                    size="small"
                    icon={<MessageCircle size={14} />}
                    href={signer.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </Button>
                ) : null}
              </div>
            ) : null}
            {signer.link ? (
              <Input
                size="small"
                readOnly
                value={signer.link}
                className="!mt-2"
                aria-label={`Enlace de firma de ${signer.name}`}
                onFocus={(event) => event.target.select()}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {vm.status === 'SENT' ? (
        <Button
          danger
          block
          className="!mt-3"
          icon={<RotateCcw size={16} />}
          loading={vm.cancelling}
          onClick={() =>
            Modal.confirm({
              title: 'Cancelar la firma',
              content:
                'Los enlaces dejan de servir y se borran las firmas que ya haya. Podras corregir el texto y enviarlo otra vez.',
              okText: 'Cancelar firma',
              okButtonProps: { danger: true },
              cancelText: 'Volver',
              onOk: vm.cancel,
            })
          }
        >
          Cancelar y corregir
        </Button>
      ) : null}
    </Card>
  )
}

/** Contrato firmado: texto y bloque de firmas con evidencia (imprimible). */
function SignedDocument({ vm }: { vm: LeaseContractViewModel }) {
  return (
    <div className="print-area space-y-6">
      <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
        {vm.text}
      </pre>
      {vm.signers.some((signer) => signer.signed) ? (
        <section>
          <h3 className="m-0 mb-3 text-sm font-semibold text-slate-900">Firmas</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {vm.signers
              .filter((signer) => signer.signed)
              .map((signer) => (
                <div key={signer.id} className="rounded-xl border border-slate-200 p-3">
                  {signer.signature ? (
                    <img
                      src={signer.signature}
                      alt={`Firma de ${signer.name}`}
                      className="h-20 w-full object-contain"
                    />
                  ) : null}
                  <p className="m-0 border-t border-slate-200 pt-1 text-sm font-medium text-slate-900">
                    {signer.name}
                  </p>
                  <p className="m-0 text-xs text-slate-500">{signer.role}</p>
                  <p className="m-0 text-xs text-slate-500">{signer.signedLabel}</p>
                  {signer.evidence ? (
                    <p className="m-0 break-all text-[11px] text-slate-400">{signer.evidence}</p>
                  ) : null}
                </div>
              ))}
          </div>
          {vm.hash ? (
            <p className="m-0 mt-3 break-all text-[11px] text-slate-400">
              Huella del texto (SHA-256): {vm.hash}
              {vm.sentAt ? ` · Enviado ${vm.sentAt}` : ''}
              {vm.signedAt ? ` · Completado ${vm.signedAt}` : ''}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

/** /agency/leases/:leaseId/contract */
export function LeaseContractPage() {
  const { leaseId = '' } = useParams()
  const vm = useLeaseContractViewModel(leaseId)

  if (vm.loading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (vm.notFound) {
    return (
      <Result
        status="404"
        title="No encontramos este contrato"
        extra={<Link to={vm.backHref}>Volver a contratos</Link>}
      />
    )
  }

  return (
    <div>
      <Link
        to={vm.backHref}
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 no-underline print:hidden"
      >
        <ArrowLeft size={16} /> Contratos
      </Link>
      <PageHeader
        title={vm.title}
        subtitle={`Contrato de arrendamiento con ${vm.tenant}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Tag color={vm.statusColor} bordered={false} className="!m-0">
              {vm.statusLabel}
            </Tag>
            {vm.status !== 'NONE' ? (
              <Button icon={<Printer size={16} />} onClick={vm.print}>
                Imprimir o PDF
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {vm.editable ? (
            <Card size="small" className="surface-card">
              <Alert
                type="info"
                showIcon
                className="!mb-3"
                message="Plantilla con los datos del contrato"
                description="Revisala y ajustala con tu asesor juridico antes de enviarla. Los cambios en el contrato, la poliza o los codeudores se reflejan al restaurar la plantilla."
              />
              <Input.TextArea
                value={vm.text}
                onChange={(event) => vm.setText(event.target.value)}
                autoSize={{ minRows: 18, maxRows: 40 }}
                aria-label="Texto del contrato"
                className="!font-sans !text-sm !leading-relaxed"
              />
              {vm.isCustomText ? (
                <Button
                  className="!mt-2"
                  icon={<RotateCcw size={14} />}
                  onClick={vm.resetText}
                >
                  Restaurar la plantilla
                </Button>
              ) : null}
            </Card>
          ) : (
            <Card size="small" className="surface-card">
              <SignedDocument vm={vm} />
            </Card>
          )}
        </div>
        <aside className="space-y-4 print:hidden">
          {vm.editable ? (
            <>
              <SendPanel vm={vm} />
              <Guarantors vm={vm} />
            </>
          ) : (
            <>
              <SignersStatus vm={vm} />
              <Guarantors vm={vm} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
