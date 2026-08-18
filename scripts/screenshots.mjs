/**
 * Capturas de pantalla del proyecto para la guia de uso.
 *
 *   npm run dev            (terminal 1)
 *   npm run screenshots    (terminal 2)
 *
 * Usa el Chrome instalado mediante el protocolo DevTools: no anade dependencias
 * ni descarga navegadores.
 *
 * Por que DevTools y no `chrome --screenshot`:
 *   `--window-size=390,844` NO produce un viewport de 390px. Headless Chrome
 *   impone un ancho minimo de ventana (500px), maqueta a ese ancho y luego
 *   recorta la imagen al tamano pedido. El resultado parece "contenido cortado"
 *   cuando en realidad la pagina nunca se maqueto como movil.
 *   `Emulation.setDeviceMetricsOverride` si fija el viewport real.
 *
 * Variables opcionales:
 *   SHOT_BASE_URL   por defecto http://localhost:5173
 *   SHOT_ONLY       captura solo las vistas cuyo nombre contenga este texto
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const BASE_URL = process.env.SHOT_BASE_URL ?? 'http://localhost:5173'
const ONLY = process.env.SHOT_ONLY ?? ''
const OUT_DIR = resolve(process.cwd(), 'docs/img')
const PORT = 9355

/** Perfiles de dispositivo reales. */
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, scale: 1, mobile: false },
  tablet: { width: 768, height: 1024, scale: 1, mobile: true },
  mobile: { width: 390, height: 844, scale: 1, mobile: true },
}

/** Vistas publicas: no requieren sesion. */
const PUBLIC_SHOTS = [
  { name: 'login', route: '/login', viewports: ['desktop', 'tablet', 'mobile'] },
  { name: 'register', route: '/register', viewports: ['desktop', 'mobile'] },
  { name: 'forgot', route: '/forgot-password', viewports: ['desktop'] },
  { name: 'notfound', route: '/ruta-inexistente', viewports: ['desktop'] },
]

/**
 * Vistas que exigen sesion con membresia ACTIVA. Sin eso la aplicacion redirige
 * a /login y la captura resultante seria la pantalla de acceso, no el modulo.
 * El script lo detecta y avisa en lugar de guardar una imagen enganosa.
 */
const PRIVATE_SHOTS = [
  { name: 'dashboard', route: '/dashboard', viewports: ['desktop', 'mobile'] },
  { name: 'apartments', route: '/apartments', viewports: ['desktop', 'mobile'] },
  { name: 'apartment-detail', route: '/apartments', viewports: ['desktop'] },
  { name: 'approvals', route: '/approvals', viewports: ['desktop'] },
  { name: 'users', route: '/users', viewports: ['desktop'] },
  { name: 'alerts', route: '/alerts', viewports: ['desktop', 'mobile'] },
  { name: 'requests', route: '/requests', viewports: ['desktop'] },
  { name: 'documents', route: '/documents', viewports: ['desktop'] },
  { name: 'messages', route: '/messages', viewports: ['desktop', 'mobile'] },
  { name: 'expenses', route: '/expenses', viewports: ['desktop'] },
]

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findBrowser() {
  return CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate)) ?? null
}

/** Cliente minimo del protocolo DevTools sobre el WebSocket nativo de Node. */
class DevTools {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      const resolver = this.pending.get(message.id)
      if (resolver) {
        this.pending.delete(message.id)
        resolver(message)
      }
    }
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    return response.result?.result?.value
  }
}

async function main() {
  const browser = findBrowser()
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

  mkdirSync(OUT_DIR, { recursive: true })

  const chrome = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${join(tmpdir(), `edifeasy-shots-${Date.now()}`)}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  console.log('\n=== Capturas de EdiFeasy ===')
  console.log(`Navegador: ${browser}`)
  console.log(`Servidor:  ${BASE_URL}`)
  console.log(`Destino:   docs/img/\n`)

  let target = null
  for (let attempt = 0; attempt < 25 && !target; attempt += 1) {
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
  const cdp = new DevTools(socket)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const skipped = []

  async function capture(shot, viewportName) {
    const viewport = VIEWPORTS[viewportName]

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.scale,
      mobile: viewport.mobile,
    })

    await cdp.send('Page.navigate', { url: `${BASE_URL}${shot.route}` })
    await sleep(3500)

    // Verificacion: si la ruta protegida nos mando a /login, la imagen no sirve.
    const info = await cdp.evaluate(
      `JSON.stringify({ path: location.pathname, vw: document.documentElement.clientWidth })`,
    )
    const { path, vw } = JSON.parse(info ?? '{}')

    if (shot.route !== path && path === '/login') {
      skipped.push(`${shot.name}-${viewportName}`)
      console.log(`  omitida  ${`${shot.name}-${viewportName}`.padEnd(26)} redirigio a /login`)
      return
    }

    /*
     * Pagina completa SIN `captureBeyondViewport`: esa opcion recompone la
     * imagen por trozos y produce artefactos (texto pintado dos veces, que
     * parece solaparse). En su lugar se agranda el viewport a la altura real
     * del documento y se captura de una sola vez.
     */
    const fullHeight = await cdp.evaluate(
      'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)',
    )
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: Math.min(Number(fullHeight) || viewport.height, 6000),
      deviceScaleFactor: viewport.scale,
      mobile: viewport.mobile,
    })
    await sleep(700)

    const result = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const data = result.result?.data
    if (!data) {
      console.log(`  fallo    ${shot.name}-${viewportName}`)
      return
    }

    const file = join(OUT_DIR, `${shot.name}-${viewportName}.png`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    const kb = Math.round(statSync(file).size / 1024)
    console.log(
      `  ok       ${`${shot.name}-${viewportName}`.padEnd(26)} viewport ${String(vw).padStart(4)}px  ${kb} KB`,
    )
  }

  const wanted = (list) =>
    list.filter((shot) => !ONLY || shot.name.includes(ONLY) || ONLY === '')

  console.log('Vistas publicas')
  for (const shot of wanted(PUBLIC_SHOTS)) {
    for (const viewportName of shot.viewports) {
      if (ONLY && !`${shot.name}-${viewportName}`.includes(ONLY)) continue
      await capture(shot, viewportName)
    }
  }

  console.log('\nVistas con sesion')
  for (const shot of wanted(PRIVATE_SHOTS)) {
    for (const viewportName of shot.viewports) {
      if (ONLY && !`${shot.name}-${viewportName}`.includes(ONLY)) continue
      await capture(shot, viewportName)
    }
  }

  socket.close()
  chrome.kill()

  if (skipped.length > 0) {
    console.log(
      `\n${skipped.length} vista(s) omitida(s) por falta de sesion.\n` +
        'Para capturarlas hace falta iniciar sesion en el navegador con un usuario\n' +
        'que tenga membresia ACTIVA. Comprueba el estado de la base con:\n' +
        '  npm run check\n',
    )
  } else {
    console.log('\nListo.\n')
  }
}

main().catch((error) => {
  console.error('\nFallo inesperado:', error)
  process.exit(1)
})
