import { useState } from 'react'
import { initials } from '@/utils/format'

/**
 * Logo del conjunto con respaldo: si no hay URL o la imagen no carga, muestra
 * las iniciales del nombre en lugar del texto alternativo roto.
 */
export function BrandLogo({
  src,
  name,
  className = 'h-8 w-8',
  fallbackClassName = 'bg-white/15 text-white',
}: {
  src: string | null | undefined
  name: string
  className?: string
  fallbackClassName?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded text-xs font-semibold ${className} ${fallbackClassName}`}
      >
        {initials(name)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailedSrc(src)}
      className={`shrink-0 rounded object-contain ${className}`}
    />
  )
}
