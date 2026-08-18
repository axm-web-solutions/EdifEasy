import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom no implementa matchMedia, necesario para los componentes responsive de antd.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  },
})

Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock')
  window.URL.revokeObjectURL = vi.fn()
}

afterEach(() => {
  cleanup()
})

/**
 * antd 5 (CSS-in-JS) genera una regla con parentesis desbalanceado para los
 * items del Select, que usa incluso el paginador de las tablas:
 *
 *   *+.ant-select-item-option-selected:not(.ant-select-item-option-disabled))
 *
 * En un navegador real es inofensiva, pero el motor de selectores de jsdom lanza
 * SyntaxError al evaluar la hoja de estilos y eso tumba el commit de React,
 * haciendo fallar tests que no tienen nada que ver con estilos.
 *
 * En jsdom los estilos no se pintan ni se asertan, asi que la solucion mas
 * simple y estable es no inyectar CSS en las pruebas. Se anula solo la escritura
 * de contenido en elementos <style>; el DOM y el comportamiento quedan intactos.
 */
function silenceStyleInjection(): void {
  for (const property of ['innerHTML', 'textContent'] as const) {
    Object.defineProperty(HTMLStyleElement.prototype, property, {
      configurable: true,
      enumerable: false,
      get: () => '',
      set: () => undefined,
    })
  }

  // rc-util tambien puede insertar reglas con la CSSOM.
  const originalInsertRule = CSSStyleSheet.prototype.insertRule
  CSSStyleSheet.prototype.insertRule = function insertRule(rule: string, index?: number) {
    try {
      return originalInsertRule.call(this, rule, index)
    } catch {
      return index ?? 0
    }
  }
}

silenceStyleInjection()

/**
 * Defensa adicional: si algun selector invalido llegara a consultarse, se ignora
 * en lugar de romper el render. Cualquier otro error se propaga sin cambios.
 */
function ignoreInvalidSelectors(target: object, method: string, fallback: unknown): void {
  const original = Reflect.get(target, method) as unknown
  if (typeof original !== 'function') return

  Reflect.set(target, method, function patched(this: unknown, ...args: unknown[]) {
    try {
      return (original as (...inner: unknown[]) => unknown).apply(this, args)
    } catch (error) {
      if (error instanceof Error && /is not a valid selector/i.test(error.message)) {
        return fallback
      }
      throw error
    }
  })
}

for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
  ignoreInvalidSelectors(proto, 'querySelector', null)
  ignoreInvalidSelectors(proto, 'querySelectorAll', [])
}
ignoreInvalidSelectors(Element.prototype, 'matches', false)
ignoreInvalidSelectors(Element.prototype, 'closest', null)
