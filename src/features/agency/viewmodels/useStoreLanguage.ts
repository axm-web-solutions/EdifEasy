import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  STORE_LANGS,
  STORE_LANG_KEY,
  STORE_TEXT,
  resolveStoreLang,
  type StoreLang,
} from '../storefront.i18n'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORE_LANG_KEY)
  } catch {
    return null
  }
}

function writeStored(lang: StoreLang) {
  try {
    window.localStorage.setItem(STORE_LANG_KEY, lang)
  } catch {
    // Sin almacenamiento (modo privado): el idioma sigue en la URL.
  }
}

/**
 * Idioma de la tienda publica. Vive en la URL (?lang=en) para que los enlaces
 * compartidos abran en el mismo idioma, y se recuerda en el navegador.
 */
export function useStoreLanguage() {
  const [params, setParams] = useSearchParams()
  const lang = resolveStoreLang(
    params.get('lang'),
    readStored(),
    typeof navigator !== 'undefined' ? navigator.language : null,
  )

  useEffect(() => {
    const previous = document.documentElement.lang
    document.documentElement.lang = lang
    return () => {
      document.documentElement.lang = previous || 'es'
    }
  }, [lang])

  const setLang = useCallback(
    (next: StoreLang) => {
      writeStored(next)
      setParams(
        (current) => {
          const copy = new URLSearchParams(current)
          copy.set('lang', next)
          return copy
        },
        { replace: true },
      )
    },
    [setParams],
  )

  /** Enlace interno de la tienda que conserva el idioma. */
  const withLang = useCallback((href: string) => `${href}?lang=${lang}`, [lang])

  return useMemo(
    () => ({
      lang,
      t: STORE_TEXT[lang],
      setLang,
      withLang,
      languages: STORE_LANGS.map((item) => ({ ...item, active: item.value === lang })),
    }),
    [lang, setLang, withLang],
  )
}

export type StoreLanguage = ReturnType<typeof useStoreLanguage>
