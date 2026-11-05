import { Alert, Button, Checkbox, ConfigProvider, Result, Skeleton } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { Controller } from 'react-hook-form'
import { Building2, CheckCircle2, Clock, FileSignature, Printer, ShieldCheck } from 'lucide-react'
import { TextField } from '@/components/forms/fields'
import { SignaturePad } from '@/components/forms/SignaturePad'
import {
  useSignContractViewModel,
  type SignContractViewModel,
} from '../viewmodels/useSignContractViewModel'

function Header({ vm }: { vm: SignContractViewModel }) {
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
        {vm.agency?.logo ? (
          <img src={vm.agency.logo} alt="" className="h-9 w-9 rounded-lg object-contain" />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ background: vm.accent }}
          >
            <Building2 size={18} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
          {vm.agency?.name ?? 'Firma de contrato'}
        </span>
        <span className="hidden items-center gap-1 text-xs text-slate-500 sm:inline-flex">
          <ShieldCheck size={14} /> Firma electronica
        </span>
      </div>
    </header>
  )
}

function Parties({ vm }: { vm: SignContractViewModel }) {
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {vm.signers.map((signer) => (
        <li key={signer.key} className="flex items-center gap-2 text-sm">
          {signer.signed ? (
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          ) : (
            <Clock size={16} className="shrink-0 text-amber-500" />
          )}
          <span className="min-w-0 flex-1 truncate text-slate-800">{signer.name}</span>
          <span className="shrink-0 text-xs text-slate-500">{signer.role}</span>
        </li>
      ))}
    </ul>
  )
}

/** Pagina publica: /firmar/:token */
export function SignContractPage() {
  const { token = '' } = useParams()
  const vm = useSignContractViewModel(token)

  return (
    <ConfigProvider theme={{ token: { colorPrimary: vm.accent, borderRadius: 10 } }}>
      <div className="min-h-screen bg-slate-50">
        <Header vm={vm} />
        <main className="mx-auto max-w-3xl px-4 py-6">
          {vm.status === 'loading' ? (
            <Skeleton active paragraph={{ rows: 12 }} />
          ) : vm.status === 'invalid' || vm.status === 'error' ? (
            <Result
              status="warning"
              title="Este enlace de firma no es valido"
              subTitle="Puede que ya lo hayas usado o que la inmobiliaria haya enviado uno nuevo. Pidele el enlace actualizado."
            />
          ) : vm.status === 'closed' ? (
            <Result
              status="info"
              title="Este contrato ya no esta abierto a firma"
              subTitle="La inmobiliaria lo cancelo o lo cambio. Te enviaran el nuevo enlace."
            />
          ) : vm.status === 'signed' ? (
            <div className="space-y-4">
              <Result
                status="success"
                className="print:hidden"
                title="¡Contrato firmado!"
                subTitle={`${vm.doneMessage}${vm.signedAt ? ` Firmaste el ${vm.signedAt}.` : ''}`}
                extra={
                  <Button icon={<Printer size={16} />} onClick={vm.print}>
                    Guardar una copia (PDF)
                  </Button>
                }
              />
              <div className="print-area rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
                  {vm.text}
                </pre>
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <Parties vm={vm} />
                  <p className="m-0 mt-3 break-all text-[11px] text-slate-400">
                    Huella del texto (SHA-256): {vm.hash}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="m-0 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <FileSignature size={14} /> Contrato para firmar
                </p>
                <h1 className="m-0 mt-1 text-xl font-semibold text-slate-900 md:text-2xl">
                  {vm.property}
                </h1>
                <p className="m-0 text-sm text-slate-600">Firmas como: {vm.signerRole}</p>
              </div>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <h2 className="m-0 mb-2 text-sm font-semibold text-slate-900">Partes</h2>
                <Parties vm={vm} />
              </section>

              <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div
                  className="max-h-[60vh] overflow-y-auto p-4 md:p-6"
                  tabIndex={0}
                  aria-label="Texto del contrato"
                  onScroll={(event) => {
                    const element = event.currentTarget
                    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 40)
                      vm.markRead()
                  }}
                >
                  <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
                    {vm.text}
                  </pre>
                </div>
                {!vm.read ? (
                  <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    Lee el contrato hasta el final para poder firmarlo.{' '}
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs underline"
                      onClick={vm.markRead}
                    >
                      Ya lo lei
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
                <h2 className="m-0 mb-3 text-base font-semibold text-slate-900">Tu firma</h2>
                <form onSubmit={vm.submit} noValidate>
                  {vm.signError ? (
                    <Alert type="error" showIcon message={vm.signError} className="!mb-3" />
                  ) : null}
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <TextField control={vm.control} name="name" label="Nombre completo" required />
                    <TextField
                      control={vm.control}
                      name="document"
                      label="Numero de documento"
                      required
                    />
                  </div>
                  <SignaturePad onChange={vm.setSignature} error={vm.signatureError} />
                  <Controller
                    control={vm.control}
                    name="accept"
                    render={({ field, fieldState }) => (
                      <div className="mb-4">
                        <Checkbox
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                        >
                          <span className="text-xs text-slate-600">
                            Lei el contrato completo, acepto su contenido y lo firmo
                            electronicamente. Entiendo que esta firma tiene la misma validez que
                            la manuscrita (Ley 527 de 1999 y Decreto 2364 de 2012) y que se
                            guardan la fecha, mi IP y mi navegador como evidencia. Mis datos se
                            tratan segun la{' '}
                            <Link to="/legal/privacidad" target="_blank">
                              politica de tratamiento de datos
                            </Link>
                            .
                          </span>
                        </Checkbox>
                        {fieldState.error ? (
                          <p className="m-0 mt-1 text-xs text-red-600">{fieldState.error.message}</p>
                        ) : null}
                      </div>
                    )}
                  />
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    disabled={!vm.read}
                    loading={vm.signing}
                    icon={<FileSignature size={18} />}
                  >
                    Firmar contrato
                  </Button>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    </ConfigProvider>
  )
}
