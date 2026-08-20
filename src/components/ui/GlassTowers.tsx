/**
 * Contrapicado de torres de cristal: la vista desde el suelo, con las fachadas
 * convergiendo hacia el cielo. Es la composicion de las fotos de arquitectura
 * corporativa, hecha aqui como SVG original.
 *
 * Por que SVG y no una fotografia:
 *   - licencia: una imagen de banco exige derechos de uso; esto es propio
 *   - peso: la foto equivalente ronda 300-800 kB; esto son unos pocos
 *   - nitidez: no pixela en pantallas de alta densidad ni al escalar el panel
 * (No es por seguridad: el despliegue no declara ninguna Content-Security-Policy
 * que bloquee dominios externos.)
 *
 * Como se construye la perspectiva
 * --------------------------------
 * Cada torre es un cuadrilatero con dos esquinas CERCA (en el borde del lienzo,
 * separadas) y dos LEJOS (junto al punto de fuga, juntas). La retícula de la
 * fachada se traza interpolando entre esos bordes.
 *
 * El detalle que hace creible el escorzo es la curva `pow(t, 2.1)` al repartir
 * las plantas: en perspectiva las lineas se comprimen al acercarse al punto de
 * fuga. Repartidas de forma uniforme el resultado parece un abanico plano.
 */

interface Point {
  x: number
  y: number
}

interface Tower {
  id: string
  /** Esquinas del borde del lienzo, las mas cercanas al observador. */
  nearLeft: Point
  nearRight: Point
  /** Esquinas junto al punto de fuga. */
  farLeft: Point
  farRight: Point
  floors: number
  columns: number
  /** Cara en sombra o reflejando el cielo. */
  tone: 'dark' | 'mid' | 'light'
  /** Paneles encendidos o reflejantes, por indice de planta. */
  highlights?: number[]
}

const VANISHING: Point = { x: 560, y: 396 }

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Compresion hacia el punto de fuga. Sin ella el escorzo no existe. */
const foreshorten = (t: number) => Math.pow(t, 2.1)

const TONE_FILL: Record<Tower['tone'], string> = {
  dark: 'url(#glass-dark)',
  mid: 'url(#glass-mid)',
  light: 'url(#glass-light)',
}

const TONE_LINE: Record<Tower['tone'], string> = {
  dark: '#0e1b2e',
  mid: '#1b3050',
  light: '#4a6d9f',
}

/*
 * Cinco torres alrededor del encuadre. Las coordenadas salen de los bordes del
 * lienzo (0..800 x 0..1000) hacia VANISHING, que queda algo a la izquierda y por
 * encima del centro para que la composicion no sea simetrica.
 */
const TOWERS: Tower[] = [
  // Izquierda, la mas cercana: entra por el borde inferior izquierdo.
  {
    id: 'izq-frente',
    nearLeft: { x: -120, y: 1080 },
    nearRight: { x: 250, y: 1080 },
    farLeft: { x: 390, y: 436 },
    farRight: { x: 492, y: 418 },
    floors: 16,
    columns: 5,
    tone: 'dark',
    highlights: [2, 5, 9],
  },
  // Izquierda alta: entra por el borde izquierdo.
  {
    id: 'izq-lateral',
    nearLeft: { x: -140, y: 190 },
    nearRight: { x: -140, y: 720 },
    farLeft: { x: 456, y: 338 },
    farRight: { x: 420, y: 418 },
    floors: 13,
    columns: 4,
    tone: 'mid',
    highlights: [4, 8],
  },
  // Cuerpo central: la torre que domina el encuadre.
  {
    id: 'centro',
    nearLeft: { x: 250, y: 1080 },
    nearRight: { x: 690, y: 1080 },
    farLeft: { x: 494, y: 418 },
    farRight: { x: 614, y: 428 },
    floors: 18,
    columns: 6,
    tone: 'light',
    highlights: [1, 3, 6, 10, 13],
  },
  // Derecha: entra por el borde derecho, cara en sombra.
  {
    id: 'der-lateral',
    nearLeft: { x: 940, y: 760 },
    nearRight: { x: 940, y: 150 },
    farLeft: { x: 630, y: 434 },
    farRight: { x: 656, y: 338 },
    floors: 14,
    columns: 5,
    tone: 'dark',
    highlights: [3, 7, 11],
  },
  // Arriba a la derecha: cierra el hueco de cielo por el vertice superior.
  {
    id: 'der-alta',
    nearLeft: { x: 560, y: -140 },
    nearRight: { x: 980, y: -140 },
    farLeft: { x: 602, y: 332 },
    farRight: { x: 694, y: 368 },
    floors: 12,
    columns: 4,
    tone: 'mid',
    highlights: [5, 9],
  },
]

function TowerFace({ tower }: { tower: Tower }) {
  const { nearLeft, nearRight, farLeft, farRight, floors, columns } = tower

  const outline = [nearLeft, nearRight, farRight, farLeft]
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  /** Lineas de forjado: una por planta, comprimiendose hacia el punto de fuga. */
  const slabs = Array.from({ length: floors }, (_, index) => {
    const t = foreshorten((index + 1) / (floors + 1))
    const left = lerp(nearLeft, farLeft, t)
    const right = lerp(nearRight, farRight, t)
    return { key: `slab-${index}`, left, right, index }
  })

  /** Parteluces: convergen hacia el punto de fuga por construccion. */
  const mullions = Array.from({ length: columns - 1 }, (_, index) => {
    const s = (index + 1) / columns
    return {
      key: `mullion-${index}`,
      near: lerp(nearLeft, nearRight, s),
      far: lerp(farLeft, farRight, s),
    }
  })

  return (
    <g>
      <polygon points={outline} fill={TONE_FILL[tower.tone]} />

      {/* Paneles que reflejan el cielo: dan el brillo del vidrio. */}
      {tower.highlights?.map((floorIndex) => {
        const slab = slabs[floorIndex]
        const next = slabs[floorIndex + 1]
        if (!slab || !next) return null
        const points = [slab.left, slab.right, next.right, next.left]
          .map((point) => `${point.x},${point.y}`)
          .join(' ')
        return (
          <polygon
            key={`hl-${floorIndex}`}
            points={points}
            fill="url(#glass-reflection)"
            opacity={tower.tone === 'dark' ? 0.4 : 0.55}
          />
        )
      })}

      {slabs.map(({ key, left, right }) => (
        <line
          key={key}
          x1={left.x}
          y1={left.y}
          x2={right.x}
          y2={right.y}
          stroke={TONE_LINE[tower.tone]}
          strokeWidth="1.1"
          opacity="0.55"
        />
      ))}

      {mullions.map(({ key, near, far }) => (
        <line
          key={key}
          x1={near.x}
          y1={near.y}
          x2={far.x}
          y2={far.y}
          stroke={TONE_LINE[tower.tone]}
          strokeWidth="1.4"
          opacity="0.5"
        />
      ))}

      {/* Canto vivo del edificio: la arista que lo separa del cielo. */}
      <polygon
        points={outline}
        fill="none"
        stroke="#93bbfd"
        strokeWidth="1.2"
        opacity="0.35"
      />
    </g>
  )
}

export function GlassTowers({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 1000"
      className={className}
      role="img"
      aria-label="Vista en contrapicado de torres de cristal convergiendo hacia el cielo"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Cielo: claro en el punto de fuga y mas profundo en los bordes. */}
        <radialGradient id="glass-sky" cx="70%" cy="40%" r="66%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="38%" stopColor="#cfe0fd" />
          <stop offset="100%" stopColor="#2f5590" />
        </radialGradient>

        <linearGradient id="glass-dark" x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0%" stopColor="#14263f" />
          <stop offset="100%" stopColor="#3a5f96" />
        </linearGradient>
        <linearGradient id="glass-mid" x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0%" stopColor="#25405f" />
          <stop offset="100%" stopColor="#6d97d4" />
        </linearGradient>
        <linearGradient id="glass-light" x1="0" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#3c5f8f" />
          <stop offset="50%" stopColor="#8fb3e6" />
          <stop offset="100%" stopColor="#dbe8fd" />
        </linearGradient>

        <linearGradient id="glass-reflection" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#93bbfd" stopOpacity="0.15" />
        </linearGradient>

        {/* Neblina atmosferica junto al punto de fuga. */}
        <radialGradient id="glass-haze" cx="70%" cy="40%" r="28%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f8fafc" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="1000" fill="url(#glass-sky)" />

      {/* Nubes tenues, para que el cielo no sea un degradado limpio */}
      <ellipse cx="300" cy="300" rx="150" ry="34" fill="#f8fafc" opacity="0.16" />
      <ellipse cx="600" cy="600" rx="180" ry="40" fill="#f8fafc" opacity="0.12" />

      {TOWERS.map((tower) => (
        <TowerFace key={tower.id} tower={tower} />
      ))}

      <circle cx={VANISHING.x} cy={VANISHING.y} r="180" fill="url(#glass-haze)" />
    </svg>
  )
}
