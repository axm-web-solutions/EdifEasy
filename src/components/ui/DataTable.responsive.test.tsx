import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { ColumnsType } from 'antd/es/table'
import { renderWithProviders } from '@/test/test-utils'
import { DataTable } from './DataTable'

interface Row {
  id: string
  numero: string
  bloque: string
  estado: string
}

const COLUMNS: ColumnsType<Row> = [
  { title: 'Apartamento', dataIndex: 'numero', key: 'numero' },
  { title: 'Bloque', dataIndex: 'bloque', key: 'bloque' },
  {
    title: 'Estado',
    dataIndex: 'estado',
    key: 'estado',
    render: (value: string) => <span data-testid="estado-render">{value.toUpperCase()}</span>,
  },
  {
    title: 'Acciones',
    key: 'actions',
    render: () => <button type="button">Editar</button>,
  },
]

const DATA: Row[] = [
  { id: '1', numero: 'A101', bloque: 'Bloque A', estado: 'ocupado' },
  { id: '2', numero: 'A102', bloque: 'Bloque A', estado: 'vacante' },
]

const NOOP = () => undefined

function renderTable() {
  return renderWithProviders(
    <DataTable<Row>
      columns={COLUMNS}
      data={DATA}
      total={2}
      loading={false}
      params={{ page: 1, pageSize: 10 }}
      onPageChange={NOOP}
      onSearch={NOOP}
      onSort={NOOP}
      onFilter={NOOP}
    />,
  )
}

/** Simula el ancho de un telefono para `useMediaQuery`. */
function mockViewport(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isMobile && query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

describe('DataTable responsive', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it('en escritorio renderiza una tabla', () => {
    mockViewport(false)
    renderTable()

    expect(screen.getByRole('table')).toBeInTheDocument()
    // Los encabezados de columna existen como celdas de cabecera.
    expect(screen.getByRole('columnheader', { name: 'Apartamento' })).toBeInTheDocument()
  })

  it('en movil NO renderiza tabla: usa tarjetas apiladas', () => {
    mockViewport(true)
    renderTable()

    // Sin tabla, por tanto sin desplazamiento horizontal ni columnas cortadas.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    // Cada registro sigue visible con todos sus datos.
    expect(screen.getByText('A101')).toBeInTheDocument()
    expect(screen.getByText('A102')).toBeInTheDocument()
  })

  it('en movil reutiliza el render de cada columna', () => {
    mockViewport(true)
    renderTable()

    // El `render` de la columna Estado se aplica igual que en la tabla.
    const rendered = screen.getAllByTestId('estado-render')
    expect(rendered).toHaveLength(2)
    expect(rendered[0]).toHaveTextContent('OCUPADO')
  })

  it('en movil conserva las acciones de cada fila', () => {
    mockViewport(true)
    renderTable()

    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2)
  })

  it('en movil muestra las etiquetas de columna junto al valor', () => {
    mockViewport(true)
    renderTable()

    // Al no haber cabecera de tabla, cada tarjeta rotula sus campos.
    expect(screen.getAllByText('Bloque').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Estado').length).toBeGreaterThan(0)
  })
})
