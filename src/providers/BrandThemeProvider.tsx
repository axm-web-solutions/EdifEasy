import { useEffect, useMemo, type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { useAuth } from '@/hooks/useAuth'
import { BRAND_CSS_VAR, DEFAULT_BRAND_COLOR, resolvePrimaryColor } from '@/utils/brand'

/**
 * Aplica la marca del condominio activo sobre el tema global.
 *
 * - Un ConfigProvider anidado re-mergé los tokens: el color primario del
 *   condominio se propaga a botones, enlaces, items seleccionados del menu,
 *   etc., sin reescribir el resto de la identidad visual.
 * - Expone el color como CSS var (`--edifeasy-brand`) para las utilidades
 *   Tailwind e inline styles que no pasan por antd.
 * - Actualiza el favicon al logo del condominio si lo tiene.
 *
 * Vive DENTRO de <AuthProvider>: depende de `currentMembership`.
 */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const { currentMembership } = useAuth()

  const primaryColor = useMemo(
    () => resolvePrimaryColor(currentMembership?.condominium_primary_color ?? DEFAULT_BRAND_COLOR),
    [currentMembership?.condominium_primary_color],
  )

  useEffect(() => {
    document.documentElement.style.setProperty(BRAND_CSS_VAR, primaryColor)
  }, [primaryColor])

  useEffect(() => {
    const logoUrl = currentMembership?.condominium_logo_url
    if (!logoUrl) return
    let link = document.head.querySelector<HTMLLinkElement>("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = logoUrl
  }, [currentMembership?.condominium_logo_url])

  return (
    <ConfigProvider
      theme={{
        inherit: true,
        token: { colorPrimary: primaryColor, colorInfo: primaryColor },
        components: {
          Menu: { darkItemSelectedBg: primaryColor },
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}