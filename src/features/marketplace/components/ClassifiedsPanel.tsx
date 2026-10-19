import { Button, Card, Input, Select, Skeleton, Tag } from 'antd'
import { Plus, Search } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/ui/states'
import type { ClassifiedsTab } from '../viewmodels/classifieds.logic'
import type { ClassifiedsViewModel } from '../viewmodels/useClassifiedsViewModel'
import { ListingCard } from './ListingCard'
import { ListingDetailDrawer } from './ListingDetailDrawer'
import { ListingFormDrawer } from './ListingFormDrawer'

const EMPTY_TEXT: Record<ClassifiedsTab, { title: string; description: string }> = {
  explorar: {
    title: 'Aun no hay publicaciones',
    description: 'Publica lo que vendes, arriendas u ofreces: comida, clases, accesorios...',
  },
  mias: {
    title: 'No tienes publicaciones',
    description: 'Lo que publiques aparece aqui con su estado.',
  },
  revisar: {
    title: 'Nada por aprobar',
    description: 'Las nuevas publicaciones de los vecinos llegan aqui.',
  },
}

/** Clasificados de los vecinos con filtros por categoria. */
export function ClassifiedsPanel({ vm, tab }: { vm: ClassifiedsViewModel; tab: ClassifiedsTab }) {
  return (
    <>
      <Card
        className="surface-card mb-4"
        styles={{ body: { padding: 12 } }}
        data-tour="classifieds-filters"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            allowClear
            prefix={<Search size={16} className="text-slate-400" />}
            placeholder="Buscar: bicicleta, arriendo, postres, ingles..."
            value={vm.search}
            onChange={(event) => vm.setSearch(event.target.value)}
            className="md:max-w-sm"
            aria-label="Buscar publicaciones"
          />
          <Select
            value={vm.sort}
            onChange={vm.setSort}
            options={vm.sortOptions}
            className="md:w-44"
            aria-label="Ordenar"
          />
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={vm.openNew}
            className="md:ml-auto"
          >
            Publicar
          </Button>
        </div>
        {tab === 'explorar' ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Tag.CheckableTag
              checked={vm.category === null}
              onChange={() => vm.setCategory(null)}
              className="!m-0 shrink-0 rounded-full border border-slate-200 px-3 py-1"
            >
              Todo
            </Tag.CheckableTag>
            {vm.categories.map((item) => (
              <Tag.CheckableTag
                key={item.value}
                checked={vm.category === item.value}
                onChange={(checked) => vm.setCategory(checked ? item.value : null)}
                className="!m-0 shrink-0 rounded-full border border-slate-200 px-3 py-1"
              >
                {item.label}
                {item.count > 0 ? ` (${item.count})` : ''}
              </Tag.CheckableTag>
            ))}
          </div>
        ) : null}
      </Card>

      {vm.status === 'loading' ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.status === 'error' ? (
        <ErrorState description="No se pudieron cargar las publicaciones." onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title={EMPTY_TEXT[tab].title}
          description={EMPTY_TEXT[tab].description}
          action={
            tab === 'revisar' ? undefined : (
              <Button type="primary" icon={<Plus size={16} />} onClick={vm.openNew}>
                Publicar
              </Button>
            )
          }
        />
      ) : vm.status === 'no-results' ? (
        <EmptyState
          title="Sin resultados"
          description="Prueba con otra busqueda o categoria."
          action={
            <Button
              onClick={() => {
                vm.setCategory(null)
                vm.setSearch('')
              }}
            >
              Quitar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {vm.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showStatus={tab !== 'explorar'}
                onOpen={() => vm.openDetail(listing.id)}
              />
            ))}
          </div>
          {vm.hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button onClick={vm.showMore}>Ver mas</Button>
            </div>
          ) : null}
        </>
      )}

      <ListingDetailDrawer vm={vm} />
      <ListingFormDrawer vm={vm} />
    </>
  )
}
