/**
 * Ilustracion de conjunto residencial para las pantallas de acceso.
 *
 * Es un SVG en linea, no una imagen: pesa unos pocos kB, se ve nitido en
 * cualquier pantalla (incluidas las Retina) y no depende de la red. Una
 * fotografia de banco de imagenes obligaria a servir cientos de kB y a cargarla
 * desde un dominio externo, que la politica de seguridad del despliegue bloquea.
 *
 * El lienzo es ANCHO Y BAJO (720x260) a proposito: se dibuja como una franja al
 * pie del panel. Con el lienzo casi cuadrado que tenia antes habia que ampliarlo
 * al doble para cubrir el ancho, y las ventanas acababan como bloques gigantes
 * detras del texto.
 *
 * Las ventanas encendidas se calculan con aritmetica sobre los indices, no al
 * azar: asi el dibujo es identico en cada render y no parpadea.
 */

interface Tower {
  x: number
  width: number
  height: number
  floors: number
  columns: number
  tone: string
}

const BASE_Y = 240

/** Alturas alternadas para que la silueta tenga ritmo y no parezca una valla. */
const TOWERS: Tower[] = [
  { x: 4, width: 66, height: 104, floors: 5, columns: 3, tone: '#243458' },
  { x: 76, width: 84, height: 158, floors: 7, columns: 3, tone: '#2b3d66' },
  { x: 166, width: 62, height: 122, floors: 6, columns: 2, tone: '#22315a' },
  { x: 234, width: 96, height: 196, floors: 9, columns: 4, tone: '#34497a' },
  { x: 336, width: 72, height: 140, floors: 6, columns: 3, tone: '#2b3d66' },
  { x: 414, width: 88, height: 172, floors: 8, columns: 3, tone: '#2e4270' },
  { x: 508, width: 64, height: 116, floors: 5, columns: 2, tone: '#243458' },
  { x: 578, width: 92, height: 182, floors: 8, columns: 4, tone: '#31456f' },
  { x: 676, width: 44, height: 96, floors: 4, columns: 2, tone: '#22315a' },
]

/** Encendida si el piso y la columna caen en el patron; da un aspecto habitado. */
function isLit(towerIndex: number, floor: number, column: number): boolean {
  return (towerIndex * 7 + floor * 3 + column * 5) % 4 !== 0
}

export function BuildingSkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 260"
      className={className}
      role="img"
      aria-label="Ilustracion de un conjunto residencial de noche"
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <linearGradient id="skyline-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b76f6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3b76f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="skyline-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Resplandor urbano detras de las torres */}
      <ellipse cx="360" cy="250" rx="380" ry="150" fill="url(#skyline-glow)" />

      {TOWERS.map((tower, towerIndex) => {
        const top = BASE_Y - tower.height
        const floorHeight = tower.height / tower.floors
        const windowWidth = (tower.width - 12) / tower.columns - 4
        const windowHeight = Math.min(floorHeight - 7, 9)

        return (
          <g key={tower.x}>
            <rect
              x={tower.x}
              y={top}
              width={tower.width}
              height={tower.height}
              rx="3"
              fill={tower.tone}
            />
            {/* Remate de la cubierta */}
            <rect
              x={tower.x - 2}
              y={top - 4}
              width={tower.width + 4}
              height="5"
              rx="2"
              fill="#18233d"
            />

            {Array.from({ length: tower.floors }).map((_, floor) =>
              Array.from({ length: tower.columns }).map((__, column) => {
                const lit = isLit(towerIndex, floor, column)
                return (
                  <rect
                    key={`${floor}-${column}`}
                    x={tower.x + 8 + column * (windowWidth + 4)}
                    y={top + 6 + floor * floorHeight}
                    width={windowWidth}
                    height={windowHeight}
                    rx="1"
                    fill={lit ? 'url(#skyline-window)' : '#16203a'}
                    opacity={lit ? 0.95 : 0.9}
                  />
                )
              }),
            )}

            {/* Portal iluminado */}
            <rect
              x={tower.x + tower.width / 2 - 7}
              y={BASE_Y - 16}
              width="14"
              height="16"
              rx="2"
              fill="url(#skyline-window)"
              opacity="0.8"
            />
          </g>
        )
      })}

      {/* Suelo, arboles y farolas */}
      <rect x="0" y={BASE_Y} width="720" height="20" fill="#16203a" />
      {[30, 128, 300, 470, 620, 700].map((cx) => (
        <g key={cx}>
          <rect x={cx - 1.5} y={BASE_Y - 10} width="3" height="10" fill="#1d2b48" />
          <circle cx={cx} cy={BASE_Y - 14} r="7" fill="#1f4a55" />
        </g>
      ))}
      {[74, 200, 390, 545].map((cx) => (
        <g key={`farola-${cx}`}>
          <rect x={cx} y={BASE_Y - 22} width="2" height="22" fill="#1d2b48" />
          <circle cx={cx + 1} cy={BASE_Y - 24} r="2.5" fill="#fde68a" opacity="0.75" />
        </g>
      ))}
    </svg>
  )
}
