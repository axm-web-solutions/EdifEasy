import { useEffect, useState } from 'react'

/**
 * Suscripcion a una media query.
 *
 * Se lee de forma sincrona en el primer render (no como los breakpoints de antd,
 * que llegan vacios y provocan un parpadeo de escritorio a movil).
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)

    setMatches(list.matches)

    // Safari < 14 solo soporta la API antigua.
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    }

    list.addListener(onChange)
    return () => list.removeListener(onChange)
  }, [query])

  return matches
}

/** Telefonos (< 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
