import { useEffect, useRef, useState } from 'react'
import { Button } from 'antd'
import { Eraser } from 'lucide-react'

/**
 * Recuadro para firmar con el dedo, lapiz o mouse. Entrega la firma como PNG
 * (data URL) o null si se borra. Presentacional: no guarda nada.
 */
export function SignaturePad({
  onChange,
  label = 'Firma',
  clearLabel = 'Borrar',
  hint = 'Firma dentro del recuadro',
  error,
}: {
  onChange: (value: string | null) => void
  label?: string
  clearLabel?: string
  hint?: string
  error?: string
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const strokes = useRef(0)
  const [empty, setEmpty] = useState(true)
  const change = useRef(onChange)
  change.current = onChange

  // Ajusta el lienzo a su tamano real (nitido en pantallas de alta densidad).
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = element.getBoundingClientRect()
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    const context = element.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineWidth = 2.2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0f172a'
  }, [])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    last.current = point(event)
  }

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const next = point(event)
    context.beginPath()
    context.moveTo(last.current.x, last.current.y)
    context.lineTo(next.x, next.y)
    context.stroke()
    last.current = next
    strokes.current += 1
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    // Un toque suelto no cuenta como firma.
    if (strokes.current < 8 || !canvas.current) return
    setEmpty(false)
    change.current(canvas.current.toDataURL('image/png'))
  }

  const clear = () => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, element.width, element.height)
    context.restore()
    strokes.current = 0
    setEmpty(true)
    change.current(null)
  }

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-slate-700">
          <span className="mr-1 text-red-500">*</span>
          {label}
        </span>
        <Button size="small" type="text" icon={<Eraser size={14} />} onClick={clear}>
          {clearLabel}
        </Button>
      </div>
      <div
        className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-white ${
          error ? 'border-red-400' : 'border-slate-300'
        }`}
      >
        <canvas
          ref={canvas}
          className="block h-44 w-full cursor-crosshair touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          role="img"
          aria-label={label}
        />
        {empty ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {hint}
          </span>
        ) : null}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-slate-200" />
      </div>
      {error ? <p className="m-0 mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
