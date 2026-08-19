/**
 * Ilustracion de conjunto residencial para las pantallas de acceso.
 *
 * Es un SVG en linea, no una fotografia: pesa unos pocos kB, se ve nitido en
 * cualquier pantalla y no depende de la red. La politica de seguridad del
 * despliegue bloquea peticiones a dominios externos, asi que una imagen de banco
 * obligaria ademas a empaquetar cientos de kB.
 *
 * El lienzo es ancho y bajo (1200x340) porque se dibuja como una franja al pie
 * del panel: a ancho completo no hay que ampliar nada y el detalle se mantiene
 * fino.
 *
 * La profundidad se consigue con TRES PLANOS, que es lo que separa una silueta
 * plana de algo con aspecto de fotografia:
 *   fondo  -> torres apagadas, sin detalle, apenas insinuadas
 *   medio  -> ventanas encendidas, sin relieve
 *   frente -> parteluces, balcones, remates de cubierta y resplandor
 *
 * Nada es aleatorio: las ventanas encendidas salen de aritmetica sobre los
 * indices, asi el dibujo es identico en cada render y no parpadea.
 */

type Layer = 'back' | 'mid' | 'front'
type Roof = 'flat' | 'antenna' | 'tank' | 'setback'

interface Tower {
  x: number
  width: number
  height: number
  floors: number
  columns: number
  layer: Layer
  roof: Roof
  /** Balcones en la fachada. Solo en el plano frontal, donde se aprecian. */
  balconies?: boolean
}

const BASE_Y = 300

const LAYER_FILL: Record<Layer, string> = {
  back: 'url(#facade-back)',
  mid: 'url(#facade-mid)',
  front: 'url(#facade-front)',
}

const LAYER_OPACITY: Record<Layer, number> = { back: 0.5, mid: 0.82, front: 1 }

const TOWERS: Tower[] = [
  // Fondo: rellenan el horizonte y dan sensacion de ciudad.
  { x: -10, width: 92, height: 168, floors: 8, columns: 3, layer: 'back', roof: 'flat' },
  { x: 150, width: 104, height: 214, floors: 10, columns: 4, layer: 'back', roof: 'antenna' },
  { x: 470, width: 88, height: 190, floors: 9, columns: 3, layer: 'back', roof: 'flat' },
  { x: 760, width: 96, height: 226, floors: 10, columns: 4, layer: 'back', roof: 'flat' },
  { x: 1040, width: 100, height: 178, floors: 8, columns: 4, layer: 'back', roof: 'tank' },

  // Plano medio
  { x: 60, width: 118, height: 138, floors: 6, columns: 4, layer: 'mid', roof: 'flat' },
  { x: 296, width: 104, height: 176, floors: 8, columns: 3, layer: 'mid', roof: 'setback' },
  { x: 590, width: 126, height: 152, floors: 7, columns: 4, layer: 'mid', roof: 'tank' },
  { x: 880, width: 112, height: 196, floors: 9, columns: 4, layer: 'mid', roof: 'antenna' },
  { x: 1108, width: 102, height: 130, floors: 6, columns: 3, layer: 'mid', roof: 'flat' },

  // Frente: los que llevan el detalle.
  {
    x: 8,
    width: 132,
    height: 96,
    floors: 4,
    columns: 4,
    layer: 'front',
    roof: 'flat',
    balconies: true,
  },
  {
    x: 186,
    width: 148,
    height: 148,
    floors: 6,
    columns: 4,
    layer: 'front',
    roof: 'tank',
    balconies: true,
  },
  { x: 380, width: 122, height: 116, floors: 5, columns: 3, layer: 'front', roof: 'flat' },
  {
    x: 540,
    width: 158,
    height: 172,
    floors: 7,
    columns: 5,
    layer: 'front',
    roof: 'setback',
    balconies: true,
  },
  {
    x: 742,
    width: 128,
    height: 124,
    floors: 5,
    columns: 4,
    layer: 'front',
    roof: 'flat',
    balconies: true,
  },
  {
    x: 910,
    width: 146,
    height: 158,
    floors: 6,
    columns: 4,
    layer: 'front',
    roof: 'antenna',
    balconies: true,
  },
  { x: 1096, width: 116, height: 104, floors: 4, columns: 3, layer: 'front', roof: 'flat' },
]

/** Encendida si el piso y la columna caen en el patron; da un aspecto habitado. */
function isLit(index: number, floor: number, column: number): boolean {
  return (index * 11 + floor * 5 + column * 7) % 5 !== 0
}

/** Medidas de la retícula de ventanas de una torre. */
function grid(tower: Tower) {
  const top = BASE_Y - tower.height
  const floorHeight = tower.height / tower.floors
  const windowWidth = (tower.width - 16) / tower.columns - 6
  return {
    top,
    floorHeight,
    windowWidth,
    windowHeight: Math.min(floorHeight - 8, 11),
  }
}

function RoofDetail({ tower }: { tower: Tower }) {
  const top = BASE_Y - tower.height
  const midX = tower.x + tower.width / 2

  if (tower.roof === 'antenna') {
    return (
      <g>
        <rect x={midX - 1} y={top - 26} width="2" height="26" fill="#1b2742" />
        <circle cx={midX} cy={top - 28} r="2.5" fill="#f87171" opacity="0.9" />
      </g>
    )
  }
  if (tower.roof === 'tank') {
    return (
      <g>
        <rect x={midX - 14} y={top - 13} width="28" height="13" rx="2" fill="#1b2742" />
        <rect x={midX - 10} y={top - 18} width="20" height="6" rx="2" fill="#1b2742" />
      </g>
    )
  }
  if (tower.roof === 'setback') {
    return (
      <rect
        x={tower.x + tower.width * 0.22}
        y={top - 18}
        width={tower.width * 0.56}
        height="18"
        rx="2"
        fill="#1b2742"
      />
    )
  }
  return null
}

export function BuildingSkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 340"
      className={className}
      role="img"
      aria-label="Ilustracion de un conjunto residencial iluminado al anochecer"
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        {/* Fachadas mas claras arriba, como recogiendo la ultima luz del cielo. */}
        <linearGradient id="facade-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a5183" />
          <stop offset="100%" stopColor="#1d2a49" />
        </linearGradient>
        <linearGradient id="facade-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e4172" />
          <stop offset="100%" stopColor="#1a2540" />
        </linearGradient>
        <linearGradient id="facade-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#26365d" />
          <stop offset="100%" stopColor="#18223c" />
        </linearGradient>

        <linearGradient id="skyline-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        <radialGradient id="skyline-halo" cx="50%" cy="100%" r="75%">
          <stop offset="0%" stopColor="#3b76f6" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#3b76f6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3b76f6" stopOpacity="0" />
        </radialGradient>

        {/* El bloom de las ventanas es lo que quita el aspecto de recorte plano. */}
        <filter id="skyline-bloom" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="600" cy="320" rx="640" ry="230" fill="url(#skyline-halo)" />

      {/* Estrellas, solo arriba, para no ensuciar la zona de las torres */}
      {[
        [90, 34],
        [242, 18],
        [388, 44],
        [520, 24],
        [700, 38],
        [846, 20],
        [980, 46],
        [1132, 28],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="#cbd5e1" opacity="0.55" />
      ))}

      {(['back', 'mid', 'front'] as Layer[]).map((layer) => (
        <g key={layer} opacity={LAYER_OPACITY[layer]}>
          {TOWERS.filter((tower) => tower.layer === layer).map((tower) => {
            const index = TOWERS.indexOf(tower)
            const { top, floorHeight, windowWidth, windowHeight } = grid(tower)
            const detailed = layer === 'front'

            return (
              <g key={tower.x}>
                <RoofDetail tower={tower} />

                <rect
                  x={tower.x}
                  y={top}
                  width={tower.width}
                  height={tower.height}
                  rx="3"
                  fill={LAYER_FILL[layer]}
                />

                {/* Ledge de cubierta: una linea clara marca el borde superior. */}
                <rect
                  x={tower.x - 3}
                  y={top - 4}
                  width={tower.width + 6}
                  height="5"
                  rx="2"
                  fill={detailed ? '#46608f' : '#22304f'}
                />

                {/* Parteluces verticales: textura de edificio real. */}
                {detailed
                  ? Array.from({ length: tower.columns - 1 }).map((_, column) => (
                      <rect
                        key={`mullion-${column}`}
                        x={tower.x + 8 + (column + 1) * (windowWidth + 6) - 3}
                        y={top + 5}
                        width="1.5"
                        height={tower.height - 10}
                        fill="#16203a"
                        opacity="0.55"
                      />
                    ))
                  : null}

                {/* Ventanas apagadas */}
                {layer !== 'back'
                  ? Array.from({ length: tower.floors }).map((_, floor) =>
                      Array.from({ length: tower.columns }).map((__, column) =>
                        isLit(index, floor, column) ? null : (
                          <rect
                            key={`dark-${floor}-${column}`}
                            x={tower.x + 8 + column * (windowWidth + 6)}
                            y={top + 7 + floor * floorHeight}
                            width={windowWidth}
                            height={windowHeight}
                            rx="1.5"
                            fill="#111a30"
                            opacity="0.85"
                          />
                        ),
                      ),
                    )
                  : null}

                {/* Balcones: una losa fina bajo cada ventana */}
                {tower.balconies
                  ? Array.from({ length: tower.floors }).map((_, floor) =>
                      Array.from({ length: tower.columns }).map((__, column) => (
                        <rect
                          key={`balcony-${floor}-${column}`}
                          x={tower.x + 6 + column * (windowWidth + 6)}
                          y={top + 7 + floor * floorHeight + windowHeight}
                          width={windowWidth + 4}
                          height="2"
                          rx="1"
                          fill="#4a6598"
                          opacity="0.5"
                        />
                      )),
                    )
                  : null}

                {/* Portal, con su division central en el plano frontal */}
                <rect
                  x={tower.x + tower.width / 2 - 11}
                  y={BASE_Y - 22}
                  width="22"
                  height="22"
                  rx="2"
                  fill="url(#skyline-window)"
                  opacity={detailed ? 0.9 : 0.55}
                />
                {detailed ? (
                  <rect
                    x={tower.x + tower.width / 2 - 0.75}
                    y={BASE_Y - 22}
                    width="1.5"
                    height="22"
                    fill="#16203a"
                    opacity="0.5"
                  />
                ) : null}
              </g>
            )
          })}
        </g>
      ))}

      {/* Ventanas encendidas, juntas, para aplicar el bloom una sola vez */}
      <g filter="url(#skyline-bloom)">
        {TOWERS.map((tower) => {
          if (tower.layer === 'back') return null
          const index = TOWERS.indexOf(tower)
          const { top, floorHeight, windowWidth, windowHeight } = grid(tower)

          return (
            <g key={`lit-${tower.x}`} opacity={tower.layer === 'front' ? 0.95 : 0.7}>
              {Array.from({ length: tower.floors }).map((_, floor) =>
                Array.from({ length: tower.columns }).map((__, column) =>
                  isLit(index, floor, column) ? (
                    <rect
                      key={`${floor}-${column}`}
                      x={tower.x + 8 + column * (windowWidth + 6)}
                      y={top + 7 + floor * floorHeight}
                      width={windowWidth}
                      height={windowHeight}
                      rx="1.5"
                      fill="url(#skyline-window)"
                    />
                  ) : null,
                ),
              )}
            </g>
          )
        })}
      </g>

      {/* Suelo, arbolado y farolas */}
      <rect x="0" y={BASE_Y} width="1200" height="40" fill="#131c33" />
      <rect x="0" y={BASE_Y} width="1200" height="2" fill="#46608f" opacity="0.35" />

      {[46, 232, 430, 626, 828, 1018, 1170].map((cx) => (
        <g key={`arbol-${cx}`}>
          <rect x={cx - 1.5} y={BASE_Y - 13} width="3" height="13" fill="#1a2740" />
          <circle cx={cx} cy={BASE_Y - 19} r="9" fill="#1c4a4f" />
          <circle cx={cx - 4} cy={BASE_Y - 15} r="6" fill="#18414a" />
          <circle cx={cx + 4} cy={BASE_Y - 16} r="6" fill="#205259" />
        </g>
      ))}

      {[132, 340, 520, 716, 930, 1120].map((cx) => (
        <g key={`farola-${cx}`}>
          <rect x={cx} y={BASE_Y - 30} width="2" height="30" fill="#1a2740" />
          <circle cx={cx + 1} cy={BASE_Y - 32} r="3" fill="#fde68a" opacity="0.8" />
          {/* Charco de luz en el suelo */}
          <ellipse cx={cx + 1} cy={BASE_Y + 6} rx="16" ry="4" fill="#fde68a" opacity="0.09" />
        </g>
      ))}
    </svg>
  )
}
