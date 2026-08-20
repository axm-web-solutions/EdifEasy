/**
 * Comprueba que el plano de apartamentos pinta la ocupacion real.
 *
 *   npm run dev            (terminal 1)
 *   npm run verify:plan    (terminal 2)
 *
 * Cruza dos fuentes independientes, unidad por unidad:
 *   - la base de datos, via los RPC de catalogo (registration_apartments)
 *   - lo que hay en pantalla, leyendo el atributo aria-label y el estado
 *     `disabled` de cada boton del plano
 *
 * Y lo repite para los tres tipos de usuario, porque la regla depende del rol:
 * un apartamento con propietario sigue libre para un arrendatario. Es justo la
 * clase de logica que se rompe en silencio al refactorizar.
 *
 * No hardcodea identificadores: descubre el condominio y sus bloques con los
 * mismos RPC que usa la pantalla de registro, asi que sirve en cualquier base.
 */
import 'dotenv/config'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const BASE_URL = process.env.SHOT_BASE_URL ?? 'http://localhost:5173'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const PUBLIC_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const PORT = 9412

/** Orden del desplegable "Tipo de usuario" en RegisterPage. */
const USER_TYPES = [
  { label: 'Propietario', index: 0, wantsOwner: true, wantsTenant: false },
  { label: 'Arrendatario', index: 1, wantsOwner: false, wantsTenant: true },
  { label: 'Ambos', index: 2, wantsOwner: true, wantsTenant: true },
]

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const HELPERS = `
  window.__fire = (el) => {
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    }
  };
  window.__openSelect = (labelText) => {
    const item = [...document.querySelectorAll('.ant-form-item')]
      .find((i) => i.textContent.includes(labelText))
    if (!item) return 'sin campo'
    const selector = item.querySelector('.ant-select-selector')
    if (!selector) return 'no es select'
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
  window.__tiles = () => JSON.stringify(
    [...document.querySelectorAll('[aria-label^="Apartamento "]')].map((button) => ({
      label: button.getAttribute('aria-label'),
      disabled: button.disabled,
    })),
  );
`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function rpc(name, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: PUBLIC_KEY,
      'Content-Type': 'application/json',
      'Content-Profile': 'tribuia',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status} ${await response.text()}`)
  return response.json()
}

async function main() {
  if (!SUPABASE_URL || !PUBLIC_KEY) {
    console.error('\nFaltan VITE_SUPABASE_URL o la clave publica en .env\n')
    process.exit(1)
  }

  const browser = CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate))
  if (!browser) {
    console.error('\nNo se encontro Chrome ni Edge instalado.\n')
    process.exit(1)
  }

  try {
    const probe = await fetch(`${BASE_URL}/register`)
    if (!probe.ok) throw new Error(String(probe.status))
  } catch {
    console.error(`\nNo responde ${BASE_URL}. Levanta "npm run dev" y reintenta.\n`)
    process.exit(1)
  }

  // Los desplegables muestran los catalogos en el orden que devuelve el RPC,
  // asi que el indice de la lista coincide con el indice de la opcion.
  const condominiums = await rpc('registration_catalog')
  if (condominiums.length === 0) {
    console.error('\nNo hay condominios ACTIVE: nada que verificar.\n')
    process.exit(1)
  }
  const condominium = condominiums[0]
  const buildings = await rpc('registration_buildings', { p_condominium: condominium.id })

  console.log('\n=== Ocupacion en el plano frente a la base ===')
  console.log(`Condominio: ${condominium.name}`)
  console.log(`Bloques:    ${buildings.map((b) => b.number).join(', ') || 'ninguno'}\n`)

  if (buildings.length === 0) process.exit(1)

  const chrome = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edifeasy-verify-'))}`,
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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  let checks = 0
  let mismatches = 0
  let unmeasured = 0

  for (const userType of USER_TYPES) {
    console.log(`\x1b[1mTipo de usuario: ${userType.label}\x1b[0m`)

    for (const [buildingIndex, building] of buildings.entries()) {
      const real = await rpc('registration_apartments', { p_building: building.id })

      await send('Page.navigate', { url: `${BASE_URL}/register` })
      await sleep(4000)
      await evaluate(HELPERS)
      await evaluate(`window.__openSelect('Tipo de usuario')`)
      await sleep(700)
      await evaluate(`window.__pickOption(${userType.index})`)
      await sleep(900)
      await evaluate(`window.__openSelect('Condominio')`)
      await sleep(700)
      await evaluate(`window.__pickOption(0)`)
      await sleep(1700)
      await evaluate(`window.__openSelect('Edificio')`)
      await sleep(700)
      await evaluate(`window.__pickOption(${buildingIndex})`)

      /*
       * Espera activa. Sin esto, cuando la consulta de apartamentos aun no habia
       * respondido el plano estaba vacio y las unidades del bloque salian todas
       * como "no aparece": diez falsos fallos de golpe, en grupos del tamano del
       * bloque, que es la pista de que faltaba el plano entero y no un estado.
       */
      let tiles = []
      for (let attempt = 0; attempt < 20; attempt += 1) {
        tiles = JSON.parse((await evaluate('window.__tiles()')) ?? '[]')
        if (tiles.length > 0) break
        await sleep(700)
      }

      if (tiles.length === 0) {
        unmeasured += 1
        console.log(
          `  \x1b[33mSIN MEDIR\x1b[0m bloque ${building.number}: el plano no llego a renderizar`,
        )
        continue
      }

      const errors = []
      for (const apartment of real) {
        const expectTaken = Boolean(
          apartment.has_pending_request ||
            (userType.wantsOwner && apartment.claimed_by_owner) ||
            (userType.wantsTenant && apartment.claimed_by_tenant),
        )
        const tile = tiles.find((item) =>
          item.label.startsWith(`Apartamento ${apartment.number},`),
        )
        checks += 1

        if (!tile) {
          errors.push(`${apartment.number}: no aparece en el plano`)
        } else if (tile.disabled !== expectTaken) {
          errors.push(
            `${apartment.number}: la base dice ${expectTaken ? 'ocupado' : 'libre'} y el plano lo pinta ${tile.disabled ? 'ocupado' : 'libre'}`,
          )
        }
      }

      const taken = real.filter(
        (a) =>
          a.has_pending_request ||
          (userType.wantsOwner && a.claimed_by_owner) ||
          (userType.wantsTenant && a.claimed_by_tenant),
      ).length

      if (errors.length === 0) {
        console.log(
          `  \x1b[32mOK\x1b[0m    bloque ${building.number}: ${real.length} unidades, ${taken} ocupada(s) y ${real.length - taken} libre(s), todas coinciden`,
        )
      } else {
        mismatches += errors.length
        console.log(`  \x1b[31mFALLA\x1b[0m bloque ${building.number}`)
        for (const error of errors) console.log(`        - ${error}`)
      }
    }
    console.log('')
  }

  socket.close()
  chrome.kill()

  console.log(
    `${checks} comprobaciones · ${mismatches} discrepancia(s) · ${unmeasured} bloque(s) sin medir\n`,
  )
  process.exit(mismatches === 0 && unmeasured === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nFallo inesperado:', error)
  process.exit(1)
})
