import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Input, Spin, Tag } from 'antd'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '@/hooks/useDashboard'
import { useAuth } from '@/hooks/useAuth'
import type { SearchResultItem } from '@/types/models'

const KIND_META: Record<string, { label: string; color: string; path: (id: string) => string }> = {
  apartment: { label: 'Apartamento', color: 'blue', path: (id) => `/apartments/${id}` },
  building: { label: 'Bloque', color: 'cyan', path: () => '/buildings' },
  resident: { label: 'Residente', color: 'purple', path: () => '/residents' },
  request: { label: 'Solicitud', color: 'gold', path: () => '/requests' },
  incident: { label: 'Incidente', color: 'volcano', path: () => '/incidents' },
  fine: { label: 'Multa', color: 'magenta', path: () => '/fines' },
  document: { label: 'Documento', color: 'green', path: () => '/documents' },
  alert: { label: 'Alerta', color: 'red', path: () => '/alerts' },
}

interface OptionGroup {
  label: React.ReactNode
  options: { value: string; label: React.ReactNode; item: SearchResultItem }[]
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const { currentCondominiumId } = useAuth()
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 300)
    return () => window.clearTimeout(timer)
  }, [term])

  const { data, isFetching } = useGlobalSearch(currentCondominiumId, debounced)

  const groups = useMemo<OptionGroup[]>(() => {
    const results = data ?? []
    const byKind = new Map<string, SearchResultItem[]>()

    for (const item of results) {
      const list = byKind.get(item.kind) ?? []
      list.push(item)
      byKind.set(item.kind, list)
    }

    return Array.from(byKind.entries()).map(([kind, items]) => ({
      label: (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {KIND_META[kind]?.label ?? kind}
        </span>
      ),
      options: items.map((item) => ({
        value: `${item.kind}:${item.id}`,
        item,
        label: (
          <div className="flex items-center justify-between gap-2 py-0.5">
            <div className="min-w-0">
              <p className="m-0 truncate text-sm text-slate-800">{item.title}</p>
              {item.subtitle ? (
                <p className="m-0 truncate text-xs text-slate-400">{item.subtitle}</p>
              ) : null}
            </div>
            <Tag color={KIND_META[item.kind]?.color ?? 'default'} bordered={false}>
              {KIND_META[item.kind]?.label ?? item.kind}
            </Tag>
          </div>
        ),
      })),
    }))
  }, [data])

  const handleSelect = (value: string) => {
    const [kind, id] = value.split(':')
    const meta = KIND_META[kind]
    if (meta) {
      navigate(meta.path(id))
      setTerm('')
      setDebounced('')
    }
  }

  return (
    <AutoComplete
      value={term}
      options={groups}
      onSearch={setTerm}
      onSelect={handleSelect}
      className="w-full max-w-md"
      popupMatchSelectWidth={380}
      notFoundContent={
        debounced.length >= 2 ? (
          isFetching ? (
            <div className="py-3 text-center">
              <Spin size="small" />
            </div>
          ) : (
            <div className="py-3 text-center text-sm text-slate-400">Sin resultados</div>
          )
        ) : null
      }
    >
      <Input
        allowClear
        size="middle"
        placeholder="Buscar apartamentos, residentes, solicitudes..."
        prefix={<Search size={16} className="text-slate-400" />}
        suffix={isFetching ? <Spin size="small" /> : null}
      />
    </AutoComplete>
  )
}
