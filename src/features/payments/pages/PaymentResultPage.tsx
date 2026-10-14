import { Button, Card, Result, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { paymentService } from '@/services/paymentService'
import { PLAN_PERIOD } from '@/constants/enums'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'

/** Cada cuanto se vuelve a consultar un pago que sigue en proceso (PSE puede tardar). */
const POLL_MS = 4000
const MAX_POLLS = 15

/**
 * Pantalla a la que Wompi devuelve al usuario (`?id=<transaccion>`). Consulta
 * el resultado en Wompi a traves de la Edge Function, que tambien lo registra
 * en la base por si el webhook aun no ha llegado.
 */
export function PaymentResultPage() {
  const [params] = useSearchParams()
  const transactionId = params.get('id')

  const query = useQuery({
    queryKey: ['payments', 'verify', transactionId],
    queryFn: () => paymentService.verify(transactionId as string),
    enabled: Boolean(transactionId),
    retry: 1,
    refetchInterval: (q) =>
      q.state.data?.status === 'PENDING' && q.state.dataUpdateCount < MAX_POLLS ? POLL_MS : false,
  })

  const payment = query.data
  const backTo = payment?.kind === 'SUBSCRIPTION' ? '/plans' : '/admin-fees'
  const backLabel = payment?.kind === 'SUBSCRIPTION' ? 'Volver a planes' : 'Volver a mis cuotas'
  const back = (
    <Link key="back" to={backTo}>
      <Button type="primary">{backLabel}</Button>
    </Link>
  )

  const detail = payment?.amount ? (
    <div className="text-sm text-slate-600">
      <div>
        {payment.kind === 'SUBSCRIPTION' && payment.plan_period
          ? `Plan ${PLAN_PERIOD[payment.plan_period].label.toLowerCase()}`
          : 'Cuota de administracion'}{' '}
        · <strong>{formatCurrency(payment.amount)}</strong>
      </div>
      <div className="text-xs text-slate-400">
        Referencia {payment.reference}
        {payment.paid_at ? ` · ${formatDateTime(payment.paid_at)}` : ''}
      </div>
    </div>
  ) : null

  let content
  if (!transactionId) {
    content = (
      <Result
        status="warning"
        title="No recibimos la informacion del pago"
        subTitle="Si completaste el pago, se reflejara en unos minutos cuando Wompi lo confirme."
        extra={
          <Link to="/dashboard">
            <Button type="primary">Ir al inicio</Button>
          </Link>
        }
      />
    )
  } else if (query.isLoading) {
    content = (
      <div className="flex flex-col items-center gap-3 py-16">
        <Spin size="large" />
        <p className="m-0 text-slate-500">Confirmando tu pago con Wompi...</p>
      </div>
    )
  } else if (query.isError || !payment) {
    content = (
      <Result
        status="error"
        title="No pudimos confirmar el pago"
        subTitle={query.error ? getErrorMessage(query.error) : undefined}
        extra={[
          <Button key="retry" onClick={() => void query.refetch()}>
            Reintentar
          </Button>,
          <Link key="home" to="/dashboard">
            <Button type="primary">Ir al inicio</Button>
          </Link>,
        ]}
      />
    )
  } else if (payment.status === 'APPROVED') {
    content = <Result status="success" title="Pago aprobado" subTitle={detail} extra={back} />
  } else if (payment.status === 'PENDING') {
    content = (
      <Result
        status="info"
        title="Tu pago esta en proceso"
        subTitle={
          <>
            {detail}
            <p className="m-0 mt-2">
              Algunos medios (como PSE) tardan unos minutos. Puedes salir de esta pantalla: el pago
              se registrara automaticamente cuando Wompi lo confirme.
            </p>
          </>
        }
        extra={[
          <Button key="refresh" loading={query.isFetching} onClick={() => void query.refetch()}>
            Consultar de nuevo
          </Button>,
          back,
        ]}
      />
    )
  } else {
    content = (
      <Result
        status="error"
        title="El pago no fue aprobado"
        subTitle={
          <>
            {detail}
            <p className="m-0 mt-2">
              {payment.status_message || 'La transaccion fue rechazada. No se hizo ningun cobro.'}
            </p>
          </>
        }
        extra={back}
      />
    )
  }

  return <Card className="surface-card mx-auto max-w-2xl">{content}</Card>
}
