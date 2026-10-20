import { useEffect, useMemo, type ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import { useAuth } from '@/hooks/useAuth'
import { BRAND_CSS_VAR, BRAND_TONES, DEFAULT_BRAND_COLOR, buildBrandTheme } from '@/utils/brand'
import { rgbChannels } from '@/utils/color'

/**
 * Aplica la marca del condominio activo sobre el tema global.
 *
 * - Deriva una paleta completa (`buildBrandTheme`) con colores de texto elegidos
 *   por contraste WCAG: si el conjunto escoge un color claro, los botones
 *   primarios, el menu y el chat usan texto oscuro en vez de blanco ilegible.
 * - Publica la paleta como variables CSS (`--edifeasy-brand`, `--brand-<tono>-rgb`,
 *   `--brand-on`, `--brand-text`) que usan las clases `brand-*` de Tailwind.
 * - Un ConfigProvider anidado lleva los mismos colores a antd.
 * - Actualiza el favicon al logo del condominio si lo tiene.
 *
 * Vive DENTRO de <AuthProvider>: depende de `currentMembership`.
 */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const { currentMembership } = useAuth()

  const brand = useMemo(
    () => buildBrandTheme(currentMembership?.condominium_primary_color ?? DEFAULT_BRAND_COLOR),
    [currentMembership?.condominium_primary_color],
  )

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty(BRAND_CSS_VAR, brand.base)
    root.setProperty('--brand-rgb', rgbChannels(brand.base))
    root.setProperty('--brand-on', brand.on)
    root.setProperty('--brand-on-rgb', rgbChannels(brand.on))
    root.setProperty('--brand-text', brand.text)
    // Con el azul de EdiFeasy se conserva la escala de :root (index.css), que es
    // la que usan las pantallas de acceso; otro color reemplaza toda la escala.
    for (const tone of BRAND_TONES) {
      if (brand.base === DEFAULT_BRAND_COLOR) root.removeProperty(`--brand-${tone}-rgb`)
      else root.setProperty(`--brand-${tone}-rgb`, rgbChannels(brand.tones[tone]))
    }
  }, [brand])

  useEffect(() => {
    // Sin logo propio (o al cambiar a un conjunto sin logo) vuelve el de EdiFeasy.
    const logoUrl = currentMembership?.condominium_logo_url || '/favicon.png'
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
        token: { colorPrimary: brand.base, colorInfo: brand.base, colorLink: brand.text },
        components: {
          Button: { primaryColor: brand.on },
          Menu: { darkItemSelectedBg: brand.menuBg, darkItemSelectedColor: brand.menuOn },
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}
