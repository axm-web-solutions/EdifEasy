/**
 * Genera las guias del proyecto en HTML y PDF.
 *
 *   npm run guide
 *
 * Que hace:
 *   1. Construye `docs/guia-de-uso.html` a partir de `docs/guia-de-uso.src.html`,
 *      incrustando las capturas de `docs/img/` como data URI.
 *   2. Imprime a PDF esa guia y `docs/guia-del-sistema.html` usando el Chrome o
 *      Edge ya instalado (modo headless, sin dependencias nuevas).
 *
 * Por que incrustar las imagenes en lugar de referenciarlas:
 *   al imprimir a PDF desde el navegador, las rutas relativas fallan segun como
 *   se abra el archivo. Incrustadas, el HTML es un unico archivo que siempre
 *   imprime igual y se puede enviar por correo tal cual.
 *
 * En la plantilla se usan marcadores:
 *   {{IMG:login-desktop|Pie de foto}}
 * Si la imagen no existe todavia, se inserta un recuadro que lo dice
 * explicitamente en lugar de dejar un hueco silencioso.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const DOCS = resolve(process.cwd(), 'docs')
const SRC = join(DOCS, 'guia-de-uso.src.html')
const OUT = join(DOCS, 'guia-de-uso.html')
const IMG_DIR = join(DOCS, 'img')
const SYSTEM_GUIDE = join(DOCS, 'guia-del-sistema.html')

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const kb = (value) => `${Math.round(value / 1024)} KB`

/* ------------------------------------------------------------------------- */
/* 1. HTML                                                                    */
/* ------------------------------------------------------------------------- */

if (!existsSync(SRC)) {
  console.error(`\nNo existe la plantilla: ${SRC}\n`)
  process.exit(1)
}

const template = readFileSync(SRC, 'utf8')

let embedded = 0
let missing = 0
let imageBytes = 0

const html = template.replace(
  /\{\{IMG:([a-z0-9-]+)(?:\|([^}]*))?\}\}/g,
  (_match, name, caption = '') => {
    /*
     * Se admiten los dos formatos: las capturas de escritorio se guardan en JPEG
     * (degradados grandes) y las de movil en PNG (interfaz plana con texto).
     */
    const candidates = [
      { path: join(IMG_DIR, `${name}.jpg`), mime: 'image/jpeg' },
      { path: join(IMG_DIR, `${name}.png`), mime: 'image/png' },
    ]
    const found = candidates.find((candidate) => existsSync(candidate.path))
    const file = found?.path ?? candidates[1].path

    if (!found) {
      missing += 1
      /*
       * Recuadro deliberadamente corto: el motivo se explica una sola vez al
       * principio del apartado. Repetir el parrafo completo en cada hueco
       * ocupaba mas espacio que el propio contenido de la guia.
       */
      return `<figure class="shot shot-missing">
        <div class="missing-box">
          <strong>Captura pendiente</strong>
          <span><code>${name}</code> &mdash; ${caption || 'vista interna'}</span>
        </div>
      </figure>`
    }

    embedded += 1
    imageBytes += statSync(file).size

    return `<figure class="shot">
      <img src="data:${found.mime};base64,${readFileSync(file).toString('base64')}" alt="${caption || name}" />
      ${caption ? `<figcaption>${caption}</figcaption>` : ''}
    </figure>`
  },
)

writeFileSync(OUT, html, 'utf8')

console.log(`\n=== Guias de EdiFeasy ===\n`)
console.log(`HTML  docs/guia-de-uso.html          ${kb(statSync(OUT).size)}`)
console.log(`      capturas incrustadas: ${embedded} (${kb(imageBytes)} en imagenes)`)
if (missing > 0) {
  console.log(`      capturas pendientes:  ${missing} (senaladas dentro del documento)`)
}

/* ------------------------------------------------------------------------- */
/* 2. PDF                                                                     */
/* ------------------------------------------------------------------------- */

const browser = CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate))

if (!browser) {
  console.log(
    '\nNo se encontro Chrome ni Edge, asi que no se genero el PDF.\n' +
      'Abre docs/guia-de-uso.html en el navegador y pulsa Ctrl+P -> Guardar como PDF\n' +
      '(activa "Graficos de fondo" para conservar colores e imagenes).\n',
  )
  process.exit(0)
}

/**
 * Chrome no acepta dos instancias sobre el mismo perfil, y reutilizar el perfil
 * del usuario abriria sus pestanas. Un perfil temporal por ejecucion lo evita.
 */
function toPdf(source, target) {
  const profile = mkdtempSync(join(tmpdir(), 'edifeasy-pdf-'))
  return new Promise((done) => {
    const child = spawn(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--disable-extensions',
        `--user-data-dir=${profile}`,
        '--no-pdf-header-footer',
        `--print-to-pdf=${target}`,
        pathToFileURL(source).href,
      ],
      { stdio: 'ignore' },
    )
    child.on('exit', () => {
      try {
        rmSync(profile, { recursive: true, force: true })
      } catch {
        // el perfil temporal a veces queda bloqueado un instante; no es critico
      }
      done(existsSync(target))
    })
  })
}

const targets = [
  { source: OUT, target: join(DOCS, 'guia-de-uso.pdf'), label: 'Guia de uso (con imagenes)' },
]
if (existsSync(SYSTEM_GUIDE)) {
  targets.push({
    source: SYSTEM_GUIDE,
    target: join(DOCS, 'guia-del-sistema.pdf'),
    label: 'Guia del sistema (conceptos)',
  })
}

console.log('')
for (const item of targets) {
  const ok = await toPdf(item.source, item.target)
  const name = item.target.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, '')
  if (ok) {
    console.log(`PDF   ${name.padEnd(30)} ${kb(statSync(item.target).size).padStart(8)}  ${item.label}`)
  } else {
    console.log(`PDF   ${name.padEnd(30)}   FALLO  (imprime con Ctrl+P desde el navegador)`)
  }
}

console.log('')
