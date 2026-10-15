import { Button, Card, Result, Spin } from 'antd'
import {
  usePaymentResultViewModel,
  type PaymentResultViewModel,
} from '../viewmodels/usePaymentResultViewModel'

function Detail({ detail }: { detail: PaymentResultViewModel['detail'] }) {
  if (!detail) return null
  return (
    <div className="text-sm text-slate-600">
      <div>
        {detail.concept} · <strong>{detail.amount}</strong>
      </div>
      <div className="text-xs text-slate-500">{detail.reference}</div>
    </div>
  )
}

/** Vista del resultado de un pago con Wompi: solo dibuja lo que entrega el ViewModel. */
export function PaymentResultPage() {
  const vm = usePaymentResultViewModel()

  const back = (
    <Button key="back" type="primary" onClick={vm.goBack}>
      {vm.backLabel}
    </Button>
  )
  const home = (
    <Button key="home" type="primary" onClick={vm.goHome}>
      Ir al inicio
    </Button>
  )

  let content
  switch (vm.state) {
    case 'missing':
      content = (
        <Result
          status="warning"
          title="No recibimos la informacion del pago"
          subTitle="Si completaste el pago, se reflejara en unos minutos cuando Wompi lo confirme."
          extra={home}
        />
      )
      break
    case 'loading':
      content = (
        <div className="flex flex-col items-center gap-3 py-16">
          <Spin size="large" />
          <p className="m-0 text-slate-500">Confirmando tu pago con Wompi...</p>
        </div>
      )
      break
    case 'error':
      content = (
        <Result
          status="error"
          title="No pudimos confirmar el pago"
          subTitle={vm.errorMessage}
          extra={[
            <Button key="retry" onClick={vm.refresh}>
              Reintentar
            </Button>,
            home,
          ]}
        />
      )
      break
    case 'approved':
      content = (
        <Result
          status="success"
          title="Pago aprobado"
          subTitle={<Detail detail={vm.detail} />}
          extra={back}
        />
      )
      break
    case 'pending':
      content = (
        <Result
          status="info"
          title="Tu pago esta en proceso"
          subTitle={
            <>
              <Detail detail={vm.detail} />
              <p className="m-0 mt-2">
                Algunos medios (como PSE) tardan unos minutos. Puedes salir de esta pantalla: el
                pago se registrara automaticamente cuando Wompi lo confirme.
              </p>
            </>
          }
          extra={[
            <Button key="refresh" loading={vm.refreshing} onClick={vm.refresh}>
              Consultar de nuevo
            </Button>,
            back,
          ]}
        />
      )
      break
    case 'rejected':
      content = (
        <Result
          status="error"
          title="El pago no fue aprobado"
          subTitle={
            <>
              <Detail detail={vm.detail} />
              <p className="m-0 mt-2">{vm.rejectionMessage}</p>
            </>
          }
          extra={back}
        />
      )
      break
  }

  return <Card className="surface-card mx-auto max-w-2xl">{content}</Card>
}
