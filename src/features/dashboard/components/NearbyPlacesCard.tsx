import { useEffect, useRef, type ReactNode } from 'react'
import { Button, Card, Segmented, Skeleton, Tag, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { MapPin, Navigation, RefreshCw } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { PLACE_CATEGORIES, type NearbyPlace } from '@/services/placesService'
import { formatDateTime } from '@/utils/format'
import { DEFAULT_BRAND_COLOR } from '@/utils/brand'
import {
  useNearbyPlacesViewModel,
  type MapPoint,
  type NearbyPlacesViewModel,
} from '../viewmodels/useNearbyPlacesViewModel'

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

function brandColor() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--edifeasy-brand')
    .trim()
  return value || DEFAULT_BRAND_COLOR
}

/** Popup construido con nodos DOM: los nombres vienen de OSM y no se interpretan como HTML. */
function buildPopup(title: string, subtitle: string, detail?: string | null) {
  const root = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = title
  root.appendChild(strong)
  const sub = document.createElement('div')
  sub.style.fontSize = '12px'
  sub.style.color = '#64748b'
  sub.textContent = subtitle
  root.appendChild(sub)
  if (detail) {
    const extra = document.createElement('div')
    extra.style.fontSize = '12px'
    extra.textContent = detail
    root.appendChild(extra)
  }
  return root
}

interface NearbyPlacesCardProps {
  condominiumId: string | null
  /** Ruta donde se edita la direccion; solo se muestra a quien puede editarla. */
  editAddressPath?: string
  dataTour?: string
}

/**
 * Vista de "Ubicacion y alrededores": mapa del conjunto y comercios cercanos.
 * Toda la logica vive en `useNearbyPlacesViewModel`; aqui solo se dibuja.
 */
export function NearbyPlacesCard({
  condominiumId,
  editAddressPath,
  dataTour,
}: NearbyPlacesCardProps) {
  const vm = useNearbyPlacesViewModel(condominiumId)

  return (
    <Card
      className="surface-card"
      data-tour={dataTour}
      title={
        <div className="flex min-w-0 items-center gap-2">
          <MapPin size={16} className="shrink-0 text-slate-500" />
          <span className="truncate text-sm font-semibold">Ubicacion y alrededores</span>
        </div>
      }
      extra={
        vm.point ? (
          <div className="flex items-center gap-2">
            <Segmented
              size="small"
              options={vm.radiusOptions}
              value={vm.radius}
              onChange={(value) => vm.setRadius(value as number)}
            />
            {vm.directionsUrl ? (
              <Tooltip title="Como llegar">
                <a
                  href={vm.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Como llegar"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 text-sm sm:min-h-0 sm:min-w-0"
                >
                  <Navigation size={14} />
                  <span className="hidden sm:inline">Como llegar</span>
                </a>
              </Tooltip>
            ) : null}
          </div>
        ) : null
      }
    >
      {vm.point ? (
        <p className="m-0 mb-3 text-xs text-slate-500">
          {vm.point.approximate
            ? `Ubicacion aproximada (no se encontro la direccion exacta): ${vm.point.label}`
            : vm.point.label}
        </p>
      ) : null}

      <CardBody vm={vm} editAddressPath={editAddressPath} />

      {vm.point ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[11px] text-slate-400">
            Datos de lugares y mapa: © colaboradores de OpenStreetMap
            {vm.placesUpdatedAt ? ` · actualizados el ${formatDateTime(vm.placesUpdatedAt)}` : ''}
          </p>
          {vm.canRefresh ? (
            <Button
              size="small"
              type="link"
              icon={<RefreshCw size={12} />}
              loading={vm.refreshing}
              onClick={vm.relocate}
            >
              Volver a ubicar
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

function CardBody({
  vm,
  editAddressPath,
}: {
  vm: NearbyPlacesViewModel
  editAddressPath?: string
}) {
  const addressLink = (label: string): ReactNode =>
    editAddressPath ? <Link to={editAddressPath}>{label}</Link> : undefined

  switch (vm.status) {
    case 'loading':
      return (
        <Skeleton.Node
          active
          className="!block !h-[380px] !w-full [&>div]:!h-full [&>div]:!w-full"
        />
      )
    case 'no-address':
      return (
        <EmptyState
          title="El condominio no tiene direccion registrada"
          description="Registra la direccion y la ciudad para ver su ubicacion y los lugares cercanos."
          action={addressLink('Registrar direccion')}
        />
      )
    case 'pending-location':
      return (
        <EmptyState
          title="Ubicacion pendiente"
          description="La administracion aun no ha ubicado el conjunto en el mapa."
        />
      )
    case 'not-found':
      return (
        <EmptyState
          title="No encontramos la direccion en el mapa"
          description="Revisa que la direccion y la ciudad del condominio esten bien escritas."
          action={addressLink('Revisar direccion')}
        />
      )
    case 'error':
      return (
        <ErrorState
          title="No se pudo ubicar el condominio en el mapa"
          description={vm.refreshError ?? undefined}
          onRetry={vm.canRefresh ? vm.refreshNow : undefined}
        />
      )
    case 'ready':
      return vm.point ? <MapAndList vm={vm} point={vm.point} /> : null
  }
}

function MapAndList({ vm, point }: { vm: NearbyPlacesViewModel; point: MapPoint }) {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const centerLayer = useRef<L.LayerGroup | null>(null)
  const placesLayer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.CircleMarker>())

  // Crea el mapa cuando cambia el punto del conjunto.
  useEffect(() => {
    if (!mapElement.current) return
    const map = L.map(mapElement.current, {
      scrollWheelZoom: false,
      // En tactil un dedo desplaza la pagina, no el mapa (se mueve con dos dedos o zoom).
      dragging: !L.Browser.mobile,
    }).setView([point.lat, point.lon], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    centerLayer.current = L.layerGroup().addTo(map)
    placesLayer.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const markerIndex = markers.current

    return () => {
      map.remove()
      mapRef.current = null
      centerLayer.current = null
      placesLayer.current = null
      markerIndex.clear()
    }
  }, [point])

  // Marcador del conjunto y circulo del radio.
  useEffect(() => {
    const map = mapRef.current
    const layer = centerLayer.current
    if (!map || !layer) return
    layer.clearLayers()
    const color = brandColor()
    const circle = L.circle([point.lat, point.lon], {
      radius: vm.radius,
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(layer)
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgb(0 0 0 / .35)"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -26],
    })
    L.marker([point.lat, point.lon], { icon, zIndexOffset: 1000 })
      .bindPopup(buildPopup(vm.condominiumName, vm.condominiumAddress))
      .addTo(layer)
    map.fitBounds(circle.getBounds(), { padding: [12, 12] })
  }, [point, vm.radius, vm.condominiumName, vm.condominiumAddress])

  // Marcadores de los lugares visibles.
  useEffect(() => {
    const layer = placesLayer.current
    if (!layer) return
    layer.clearLayers()
    markers.current.clear()
    for (const place of vm.visiblePlaces) {
      const meta = PLACE_CATEGORIES[place.category]
      const marker = L.circleMarker([place.lat, place.lon], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: meta.hex,
        fillOpacity: 0.95,
      })
        .bindPopup(
          buildPopup(
            place.name,
            `${meta.label} · ${formatDistance(place.distance)}`,
            place.address,
          ),
        )
        .addTo(layer)
      markers.current.set(place.id, marker)
    }
  }, [vm.visiblePlaces])

  const focusPlace = (place: NearbyPlace) => {
    const map = mapRef.current
    if (!map) return
    map.setView([place.lat, place.lon], Math.max(map.getZoom(), 17))
    markers.current.get(place.id)?.openPopup()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative isolate z-0 overflow-hidden rounded-lg border border-slate-200">
        <div ref={mapElement} className="h-[300px] w-full sm:h-[380px]" />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {vm.categories.map((item) => (
            <Tag.CheckableTag
              key={item.category}
              checked={item.active}
              onChange={(checked) => vm.toggleCategory(item.category, checked)}
              className="!m-0 !border !border-slate-200"
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: item.color }}
              />
              {item.label} ({item.count})
            </Tag.CheckableTag>
          ))}
        </div>

        {vm.placesError ? (
          <ErrorState title="No se pudieron cargar los lugares cercanos" onRetry={vm.retryPlaces} />
        ) : vm.listedPlaces.length === 0 ? (
          <EmptyState
            title={vm.refreshing ? 'Buscando lugares cercanos...' : 'Sin lugares en este radio'}
            description={
              vm.refreshing ? undefined : 'Amplia el radio de busqueda o activa mas categorias.'
            }
          />
        ) : (
          <ul className="m-0 max-h-[320px] list-none divide-y divide-slate-100 overflow-y-auto p-0 pr-1">
            {vm.listedPlaces.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => focusPlace(place)}
                  className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-1 py-2 text-left hover:bg-slate-50"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: PLACE_CATEGORIES[place.category].hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {place.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {PLACE_CATEGORIES[place.category].label}
                      {place.address ? ` · ${place.address}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {formatDistance(place.distance)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {vm.hiddenFromList > 0 ? (
          <p className="m-0 mt-2 text-xs text-slate-400">
            Mostrando los {vm.listedPlaces.length} mas cercanos de {vm.visiblePlaces.length}. Todos
            aparecen en el mapa.
          </p>
        ) : null}
      </div>
    </div>
  )
}
