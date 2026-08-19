/**
 * Auditoria de responsive: mide en el navegador, no a ojo.
 *
 *   npm run dev                (terminal 1)
 *   npm run responsive         (terminal 2)
 *
 * Para cada ancho y cada vista comprueba:
 *   1. Desbordamiento horizontal de la pagina (scrollWidth > clientWidth).
 *      Es el fallo que en un telefono se ve como "la pantalla se mueve de lado".
 *   2. Elementos mas anchos que el viewport, con su selector, para saber cual es.
 *   3. Objetivos tactiles por debajo de 44 px de alto (guia de Apple y Material).
 *   4. Texto por debajo de 16 px en campos de formulario, que hace que iOS
 *      aplique zoom al enfocarlos y descoloque la maqueta.
 *
 * `--hide-scrollbars` NO se usa: la barra de desplazamiento resta ancho real y
 * ocultarla falsearia justo lo que se quiere medir.
 *
 * Variables opcionales:
 *   SHOT_BASE_URL   por defecto http://localhost:5173
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const BASE_URL = process.env.SHOT_BASE_URL ?? 'http://localhost:5173'
const PORT = 9366

/** Anchos exigidos por el proyecto (README, apartado 21). */
const WIDTHS = [
  { width: 1920, height: 1080, mobile: false },
  { width: 1440, height: 900, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 768, height: 1024, mobile: true },
  { width: 390, height: 844, mobile: true },
]

/*
 * Los Select de antd no son <select> nativos: ignoran .click() y necesitan la
 * secuencia pointerdown/mousedown/mouseup/click.
 */
const HELPERS = `
  window.__fire = (el) => {
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    }
  };
  window.__openSelect = (labelText) => {
    const item = [...document.querySelectorAll('.ant-form-item')]
      .find((i) => i.textContent.includes(labelText))
    if (!item) return 'sin campo: ' + labelText
    const selector = item.querySelector('.ant-select-selector')
    if (!selector) return 'no es select: ' + labelText
    window.__fire(selector)
    return 'ok'
  };
  window.__pickOption = (index) => {
    const options = [...document.querySelectorAll(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')]
    if (!options.length) return 'sin opciones'
    window.__fire(options[index] ?? options[0])
    return 'ok'
  };
`

const PLAN_STEPS = [
  `window.__openSelect('Tipo de usuario')`,
  `window.__pickOption(1)`,
  `window.__openSelect('Condominio')`,
  `window.__pickOption(0)`,
  `window.__openSelect('Edificio')`,
  `window.__pickOption(0)`,
]

const VIEWS = [
  { name: 'login', route: '/login' },
  { name: 'register', route: '/register' },
  /*
   * `expectPlan` obliga a comprobar que los pasos funcionaron. Sin el, cuando la
   * interaccion fallaba (el desplegable de antd tarda mas en abrir en pantallas
   * estrechas) la vista se medía SIN el plano y salia "OK" enganoso.
   */
  { name: 'register + plano', route: '/register', steps: PLAN_STEPS, expectPlan: true },
  { name: 'recuperar', route: '/forgot-password' },
]

/** Se ejecuta dentro de la pagina. Devuelve el diagnostico como JSON. */
const AUDIT = `
  (() => {
    const doc = document.documentElement
    const viewport = doc.clientWidth

    /*
     * Un elemento solo puede empujar la pagina si NINGUN antecesor lo recorta.
     * Sin esta comprobacion se delatan los adornos decorativos (resplandores
     * con posicion negativa, la ilustracion del panel) que viven dentro de un
     * \`overflow-hidden\` y no desplazan nada: 11 falsos positivos en la primera
     * version de este script.
     */
    const isClipped = (el) => {
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        if (getComputedStyle(node).overflowX !== 'visible') return true
      }
      return false
    }

    const wide = []
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      // Se ignora lo que antd saca del flujo (menus flotantes, tooltips).
      if (el.closest('.ant-select-dropdown, .ant-tooltip, .ant-modal-wrap')) continue
      if (isClipped(el)) continue
      if (rect.right > viewport + 1 || rect.left < -1) {
        wide.push({
          selector: el.tagName.toLowerCase() +
            (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
              : ''),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        })
      }
    }

    const small = []
    for (const el of document.querySelectorAll('input, textarea, .ant-select-selector')) {
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size && size < 16) small.push({ tag: el.tagName.toLowerCase(), fontSize: size })
    }

    const tiny = []
    for (const el of document.querySelectorAll('button, a[role="button"], .ant-select-single')) {
      const rect = el.getBoundingClientRect()
      if (rect.height > 0 && rect.height < 44) {
        // Los enlaces de texto y los botones pequenos declarados no cuentan.
        if (el.classList.contains('ant-btn-link') || el.classList.contains('ant-btn-sm')) continue
        if (el.classList.contains('ant-btn-text')) continue
        tiny.push({
          text: (el.textContent || '').trim().slice(0, 28),
          height: Math.round(rect.height),
        })
      }
    }

    return JSON.stringify({
      viewport,
      scrollWidth: doc.scrollWidth,
      overflow: Math.max(0, doc.scrollWidth - viewport),
      wide: wide.slice(0, 5),
      smallFonts: small.slice(0, 4),
      tinyTargets: tiny.slice(0, 4),
      planTiles: [...document.querySelectorAll('[aria-label^="Apartamento "]')].length,
      planTileHeight: (() => {
        const tile = document.querySelector('[aria-label^="Apartamento "]')
        return tile ? Math.round(tile.getBoundingClientRect().height) : null
      })(),
      asideVisible: Boolean(document.querySelector('aside')?.offsetWidth),
    })
  })()
`

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate))
  if (!browser) {
    console.error('\nNo se encontro Chrome ni Edge instalado.\n')
    process.exit(1)
  }

  try {
    const probe = await fetch(`${BASE_URL}/login`)
    if (!probe.ok) throw new Error(String(probe.status))
  } catch {
    console.error(`\nNo responde ${BASE_URL}. Levanta "npm run dev" y reintenta.\n`)
    process.exit(1)
  }

  const chrome = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edifeasy-responsive-'))}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let target = null
  for (let attempt = 0; attempt < 30 && !target; attempt += 1) {
    await sleep(400)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((item) => item.type === 'page')
    } catch {
      // el navegador aun no expone el endpoint
    }
  }
  if (!target) {
    console.error('No se pudo conectar al navegador.')
    chrome.kill()
    process.exit(1)
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => (socket.onopen = resolve))
  let nextId = 1
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true })
    return response.result?.result?.value
  }

  console.log('\n=== Responsive de EdiFeasy ===')
  console.log(`Servidor: ${BASE_URL}\n`)

  /*
   * Visita de calentamiento. En frio, Vite compila los modulos durante la
   * primera carga y la primera medida sale falseada: dio "panel lateral oculto"
   * a 1920px, cuando a ese ancho siempre esta visible.
   */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url: `${BASE_URL}/login` })
  await sleep(4500)

  let problems = 0

  for (const view of VIEWS) {
    console.log(`\x1b[1m${view.name}\x1b[0m  (${view.route})`)

    for (const { width, height, mobile } of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      })
      await send('Page.navigate', { url: `${BASE_URL}${view.route}` })
      // Con pasos de interaccion hay que esperar a que el formulario responda:
      // con 2800 ms el de registro a 390 px aun no estaba listo y los pasos
      // fallaban en cadena.
      await sleep(view.steps ? 4000 : 2800)

      if (view.steps) {
        await evaluate(HELPERS)
        for (const step of view.steps) {
          await evaluate(step)
          // En pantallas estrechas el desplegable tarda mas en montarse.
          await sleep(width < 500 ? 1500 : 1000)
        }
      }

      const report = JSON.parse((await evaluate(AUDIT)) ?? '{}')
      const issues = []

      if (view.expectPlan && !report.planTiles) {
        issues.push('no se pudo abrir el plano: la medida de esta vista no vale')
      }
      if (report.overflow > 0) issues.push(`desborda ${report.overflow}px en horizontal`)
      if (report.wide?.length) {
        issues.push(
          `fuera del viewport: ${report.wide.map((w) => `${w.selector} (${w.left}..${w.right})`).join(', ')}`,
        )
      }
      if (mobile && report.smallFonts?.length) {
        issues.push(`campos con letra < 16px: ${report.smallFonts.length} (iOS hara zoom)`)
      }
      if (mobile && report.tinyTargets?.length) {
        issues.push(
          `objetivos < 44px: ${report.tinyTargets.map((t) => `"${t.text}" ${t.height}px`).join(', ')}`,
        )
      }

      const extra = [
        report.planTiles ? `${report.planTiles} unidades de ${report.planTileHeight}px` : null,
        `panel lateral ${report.asideVisible ? 'visible' : 'oculto'}`,
      ]
        .filter(Boolean)
        .join(' · ')

      if (issues.length === 0) {
        console.log(`  \x1b[32mOK\x1b[0m    ${String(width).padStart(4)}px  ${extra}`)
      } else {
        problems += issues.length
        console.log(`  \x1b[31mFALLA\x1b[0m ${String(width).padStart(4)}px  ${extra}`)
        for (const issue of issues) console.log(`        - ${issue}`)
      }
    }
    console.log('')
  }

  socket.close()
  chrome.kill()

  console.log(
    problems === 0
      ? 'Sin problemas de responsive.\n'
      : `${problems} problema(s) detectado(s).\n`,
  )
  process.exit(problems === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nFallo inesperado:', error)
  process.exit(1)
})
