import type { ReactNode } from 'react'

interface AmountListItemProps {
  title: ReactNode
  description?: ReactNode
  status?: ReactNode
  amount: string
  action?: ReactNode
}

/**
 * Fila de lista con monto: cuotas, multas o pagos. Titulo y detalle a la
 * izquierda; estado, monto y accion opcional a la derecha. Se acomoda en movil.
 */
export function AmountListItem({
  title,
  description,
  status,
  amount,
  action,
}: AmountListItemProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium text-slate-800">{title}</p>
        {description ? <p className="m-0 text-xs text-slate-500">{description}</p> : null}
      </div>
      {status}
      <strong className="w-28 text-right tabular-nums">{amount}</strong>
      {action}
    </li>
  )
}

/** Contenedor de `AmountListItem` con separadores. */
export function AmountList({ children }: { children: ReactNode }) {
  return <ul className="m-0 list-none divide-y divide-slate-100 p-0">{children}</ul>
}
