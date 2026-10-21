import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAllApartments } from '@/hooks/useApartments'
import {
  useAccountingIntegrations,
  useAccountingMutations,
  useAccountingRuns,
} from '@/hooks/useAccounting'
import { getErrorMessage } from '@/lib/errors'
import { downloadBlob } from '@/utils/export'
import { formatRelative } from '@/utils/format'
import type { AccountingImportKind, AccountingProvider } from '@/types/database'
import type { ImportResult } from '@/services/accountingService'
import {
  IMPORT_KINDS,
  PROVIDERS,
  mapImport,
  parseCsv,
  templateCsv,
  toIntegrationView,
  type MappedImport,
} from './finances.logic'

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(IMPORT_KINDS).map(([key, spec]) => [key, spec.label]),
)

/**
 * Conexion contable (solo administracion): Siigo y Alegra por API; el resto por
 * archivo CSV. Tambien enlaza los codigos que no coincidieron con una unidad.
 */
export function useAccountingConnectionsViewModel(enabled: boolean) {
  const { currentCondominiumId } = useAuth()
  const integrationsQuery = useAccountingIntegrations(currentCondominiumId, enabled)
  const runsQuery = useAccountingRuns(currentCondominiumId, enabled)
  const apartmentsQuery = useAllApartments(enabled ? currentCondominiumId : null)
  const mutations = useAccountingMutations()

  const integrations = useMemo(
    () => (integrationsQuery.data ?? []).map(toIntegrationView),
    [integrationsQuery.data],
  )

  // ------------------------------------------------------- conectar por API
  const [connectOpen, setConnectOpen] = useState(false)
  const [provider, setProvider] = useState<'SIIGO' | 'ALEGRA'>('SIIGO')
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [matchBy, setMatchBy] = useState<'CODE_IN_NAME' | 'IDENTIFICATION'>('CODE_IN_NAME')
  const fields =
    provider === 'SIIGO'
      ? [
          {
            key: 'username',
            label: 'Usuario API',
            type: 'text',
            placeholder: 'correo@empresa.com',
          },
          {
            key: 'access_key',
            label: 'Llave de acceso (access key)',
            type: 'password',
            placeholder: '',
          },
        ]
      : [
          {
            key: 'email',
            label: 'Correo de Alegra',
            type: 'text',
            placeholder: 'correo@empresa.com',
          },
          { key: 'token', label: 'Token de la API', type: 'password', placeholder: '' },
        ]
  const connectReady = fields.every((field) => (credentials[field.key] ?? '').trim().length > 0)

  const connect = () => {
    if (!currentCondominiumId || !connectReady) return
    mutations.connect.mutate(
      {
        condominiumId: currentCondominiumId,
        provider,
        credentials: Object.fromEntries(fields.map((f) => [f.key, credentials[f.key].trim()])),
        settings: { matchBy, monthsBack: 12 },
      },
      {
        onSuccess: () => {
          setConnectOpen(false)
          setCredentials({})
        },
      },
    )
  }

  // ---------------------------------------------------------- por archivo
  const [importKind, setImportKind] = useState<AccountingImportKind>('UNIT_STATEMENTS')
  const [fileName, setFileName] = useState<string | null>(null)
  const [mapped, setMapped] = useState<MappedImport | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileProvider, setFileProvider] = useState<AccountingProvider>('WORLD_OFFICE')

  const readFile = async (file: File, kind = importKind) => {
    setResult(null)
    setFileError(null)
    setFileName(file.name)
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setMapped(null)
      setFileError(
        'Guarda el archivo como CSV desde Excel (Archivo > Guardar como > CSV) y cargalo de nuevo.',
      )
      return
    }
    const text = await file.text()
    const next = mapImport(kind, parseCsv(text))
    setMapped(next)
    if (next.missing.length)
      setFileError(
        `Faltan columnas: ${next.missing.join(', ')}. Descarga la plantilla para ver el formato.`,
      )
    else if (next.rows.length === 0) setFileError('El archivo no tiene filas con datos.')
  }

  const fileIntegrationId =
    integrationsQuery.data?.find((item) => item.mode === 'FILE' && item.provider === fileProvider)
      ?.id ?? null

  const importFile = () => {
    if (!currentCondominiumId || !mapped || mapped.missing.length || mapped.rows.length === 0)
      return
    const run = () =>
      mutations.importRows.mutate(
        {
          condominiumId: currentCondominiumId,
          kind: importKind,
          rows: mapped.rows,
          integrationId: fileIntegrationId,
        },
        { onSuccess: (data) => setResult(data) },
      )
    // La primera carga registra el programa de origen como conexion por archivo.
    if (!fileIntegrationId) {
      mutations.addFile.mutate(
        { condominiumId: currentCondominiumId, provider: fileProvider },
        { onSuccess: run },
      )
    } else run()
  }

  // ----------------------------------------- codigos sin unidad -> enlazar
  const [links, setLinks] = useState<Record<string, string>>({})
  const unitOptions = useMemo(
    () =>
      (apartmentsQuery.data ?? []).map((apartment) => ({
        value: apartment.id,
        label: `${apartment.building?.name ? `${apartment.building.name} · ` : ''}${apartment.number}`,
      })),
    [apartmentsQuery.data],
  )
  const saveLink = (code: string) => {
    const apartmentId = links[code]
    if (!currentCondominiumId || !apartmentId) return
    mutations.link.mutate(
      { condominiumId: currentCondominiumId, code, apartmentId },
      {
        onSuccess: () =>
          setResult((current) =>
            current
              ? { ...current, unmatched: (current.unmatched ?? []).filter((item) => item !== code) }
              : current,
          ),
      },
    )
  }

  return {
    loading: integrationsQuery.isLoading,
    integrations,
    runs: (runsQuery.data ?? []).map((run) => ({
      id: run.id,
      label: KIND_LABELS[run.kind] ?? run.kind,
      source: run.source === 'API' ? 'Automatica' : 'Archivo',
      status: run.status,
      statusColor: run.status === 'OK' ? 'green' : run.status === 'PARTIAL' ? 'gold' : 'red',
      statusLabel:
        run.status === 'OK' ? 'Completa' : run.status === 'PARTIAL' ? 'Parcial' : 'Fallo',
      detail:
        run.error ??
        (() => {
          const stats = run.stats as { imported?: number; skipped?: number }
          return `${stats?.imported ?? 0} importados${stats?.skipped ? ` · ${stats.skipped} omitidos` : ''}`
        })(),
      when: formatRelative(run.created_at),
    })),

    // API
    connectOpen,
    openConnect: () => {
      mutations.connect.reset()
      setConnectOpen(true)
    },
    closeConnect: () => setConnectOpen(false),
    provider,
    setProvider: (value: 'SIIGO' | 'ALEGRA') => {
      setProvider(value)
      setCredentials({})
    },
    apiProviders: PROVIDERS.filter((p) => p.mode === 'API'),
    fields,
    credentials,
    setCredential: (key: string, value: string) =>
      setCredentials((current) => ({ ...current, [key]: value })),
    matchBy,
    setMatchBy,
    connect,
    connectReady,
    connecting: mutations.connect.isPending,
    connectError: mutations.connect.error ? getErrorMessage(mutations.connect.error) : null,
    sync: (id: string) => mutations.sync.mutate(id),
    syncing: mutations.sync.isPending ? mutations.sync.variables : null,
    syncError: mutations.sync.error ? getErrorMessage(mutations.sync.error) : null,
    disconnect: (id: string, mode: 'API' | 'FILE') =>
      mutations.disconnect.mutate({ integrationId: id, mode }),

    // archivo
    fileProviders: PROVIDERS.filter((p) => p.mode === 'FILE'),
    fileProvider,
    setFileProvider,
    kindOptions: Object.entries(IMPORT_KINDS).map(([value, spec]) => ({
      value,
      label: spec.label,
    })),
    importKind,
    kindDescription: IMPORT_KINDS[importKind].description,
    setImportKind: (kind: AccountingImportKind) => {
      setImportKind(kind)
      setMapped(null)
      setFileName(null)
      setFileError(null)
      setResult(null)
    },
    downloadTemplate: () =>
      downloadBlob(
        `\uFEFF${templateCsv(importKind)}`,
        `plantilla-${importKind.toLowerCase()}.csv`,
        'text/csv;charset=utf-8',
      ),
    readFile: (file: File) => void readFile(file),
    fileName,
    preview:
      mapped && !mapped.missing.length
        ? { rows: mapped.rows.length, columns: Object.values(mapped.columns) }
        : null,
    fileError,
    importFile,
    importing: mutations.importRows.isPending || mutations.addFile.isPending,
    importError: mutations.importRows.error ? getErrorMessage(mutations.importRows.error) : null,
    result: result
      ? {
          imported: result.imported,
          skipped: result.skipped,
          unmatched: result.unmatched ?? [],
        }
      : null,

    // enlaces
    unitOptions,
    links,
    setLink: (code: string, apartmentId: string) =>
      setLinks((current) => ({ ...current, [code]: apartmentId })),
    saveLink,
    linking: mutations.link.isPending ? mutations.link.variables?.code : null,
  }
}

export type AccountingConnectionsViewModel = ReturnType<typeof useAccountingConnectionsViewModel>
