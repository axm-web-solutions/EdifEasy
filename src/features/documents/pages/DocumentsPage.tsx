import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Space, Tag, Tooltip, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Download, Eye, FileText, Plus, Trash2, Upload as UploadIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { FormDrawer, confirmDelete } from '@/components/ui/FormDrawer'
import {
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import { useTableParams } from '@/hooks/useTableParams'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentCategories, useDocumentMutations, useDocuments } from '@/hooks/useDocuments'
import { useAllBuildings } from '@/hooks/useBuildings'
import { documentSchema, type DocumentFormValues } from '@/schemas/documents'
import { AUDIENCE_TYPE, toOptions } from '@/constants/enums'
import { documentService } from '@/services/documentService'
import { formatDate, formatFileSize } from '@/utils/format'
import { getErrorMessage } from '@/lib/errors'
import { notify } from '@/lib/notify'
import type { DocumentRow } from '@/types/database'
import type { DocumentWithRelations } from '@/types/models'
import type { ExportColumn } from '@/utils/export'

const { Text } = Typography

const EXPORT_COLUMNS: ExportColumn<DocumentWithRelations>[] = [
  { key: 'title', header: 'Titulo', value: (row) => row.title },
  { key: 'category', header: 'Categoria', value: (row) => row.category?.name ?? '' },
  { key: 'file', header: 'Archivo', value: (row) => row.file_name },
  { key: 'size', header: 'Tamano', value: (row) => formatFileSize(row.file_size) },
  { key: 'visibility', header: 'Visibilidad', value: (row) => AUDIENCE_TYPE[row.visibility].label },
  { key: 'restricted', header: 'Restringido', value: (row) => (row.is_restricted ? 'Si' : 'No') },
  { key: 'uploader', header: 'Subido por', value: (row) => row.uploader?.full_name ?? '' },
  { key: 'created', header: 'Fecha', value: (row) => formatDate(row.created_at) },
]

const EMPTY: DocumentFormValues = {
  title: '',
  description: '',
  category_id: null,
  building_id: null,
  apartment_id: null,
  visibility: 'CONDOMINIUM',
  is_restricted: false,
}

export function DocumentsPage() {
  const { currentCondominiumId, hasPermission, user } = useAuth()
  const canManage = hasPermission('manageDocuments')

  const table = useTableParams({ pageSize: 10 })
  const query = useDocuments(currentCondominiumId, table.params)
  const categoriesQuery = useDocumentCategories(currentCondominiumId)
  const buildingsQuery = useAllBuildings(currentCondominiumId)
  const { upload, remove, download } = useDocumentMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: EMPTY,
  })

  const submit = form.handleSubmit(async (values) => {
    if (!currentCondominiumId || !user) return

    const file = fileList[0]?.originFileObj
    if (!file) {
      notify.error('Selecciona un archivo para subir')
      return
    }

    await upload.mutateAsync({
      condominiumId: currentCondominiumId,
      file,
      title: values.title,
      description: values.description || null,
      categoryId: values.category_id || null,
      buildingId: values.building_id || null,
      apartmentId: values.apartment_id || null,
      visibility: values.visibility,
      isRestricted: values.is_restricted,
      uploadedBy: user.id,
    })

    form.reset(EMPTY)
    setFileList([])
    setFormOpen(false)
  })

  const handlePreview = async (row: DocumentWithRelations) => {
    try {
      const url = await documentService.previewUrl(row)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      notify.error(getErrorMessage(error))
    }
  }

  const columns: ColumnsType<DocumentWithRelations> = [
    {
      title: 'Documento',
      dataIndex: 'title',
      key: 'title',
      fixed: 'left',
      width: 300,
      render: (_, row) => (
        <Space>
          <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
            <FileText size={16} />
          </span>
          <div className="min-w-0">
            <p className="m-0 font-medium text-slate-800">{row.title}</p>
            <Text type="secondary" className="text-xs">
              {row.file_name} · {formatFileSize(row.file_size)}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Categoria',
      key: 'category',
      width: 150,
      render: (_, row) => row.category?.name ?? '—',
    },
    {
      title: 'Visibilidad',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 170,
      render: (value: DocumentRow['visibility'], row) => (
        <Space size={4} wrap>
          <Tag color={AUDIENCE_TYPE[value].color} bordered={false}>
            {AUDIENCE_TYPE[value].label}
          </Tag>
          {row.is_restricted ? (
            <Tag color="red" bordered={false}>
              Restringido
            </Tag>
          ) : null}
        </Space>
      ),
    },
    { title: 'Subido por', key: 'uploader', width: 170, render: (_, row) => row.uploader?.full_name ?? '—' },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Acciones',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Previsualizar">
            <Button size="small" icon={<Eye size={14} />} onClick={() => void handlePreview(row)} />
          </Tooltip>
          <Tooltip title="Descargar">
            <Button
              size="small"
              icon={<Download size={14} />}
              loading={download.isPending}
              onClick={() => download.mutate(row)}
            />
          </Tooltip>
          {canManage ? (
            <Tooltip title="Eliminar">
              <Button
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={async () => {
                  const ok = await confirmDelete({
                    title: `Eliminar "${row.title}"?`,
                    content: 'Se eliminara tambien el archivo del almacenamiento.',
                  })
                  if (ok) await remove.mutateAsync(row)
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="Reglamentos, actas, manuales y archivos del condominio."
        actions={
          canManage ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
              Subir documento
            </Button>
          ) : null
        }
      />

      <DataTable<DocumentWithRelations>
        columns={columns}
        data={query.data?.data ?? []}
        total={query.data?.total ?? 0}
        loading={query.isFetching}
        isError={query.isError}
        errorMessage={query.error ? getErrorMessage(query.error) : undefined}
        onRetry={() => void query.refetch()}
        params={table.params}
        onPageChange={table.setPage}
        onSearch={table.setSearch}
        onSort={table.setSort}
        onFilter={table.setFilter}
        onDateRange={table.setDateRange}
        onReset={table.reset}
        hasActiveFilters={table.hasActiveFilters}
        showDateFilter
        filters={[
          {
            key: 'category_id',
            label: 'Categoria',
            width: 190,
            options: (categoriesQuery.data ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            })),
          },
          { key: 'visibility', label: 'Visibilidad', options: toOptions(AUDIENCE_TYPE) },
        ]}
        searchPlaceholder="Buscar por titulo, descripcion o archivo"
        exportColumns={EXPORT_COLUMNS}
        exportFileName="documentos"
        exportFetcher={async () => {
          if (!currentCondominiumId) return []
          const result = await documentService.list(currentCondominiumId, {
            ...table.params,
            page: 1,
            pageSize: 1000,
          })
          return result.data
        }}
        emptyTitle="Sin documentos"
        emptyDescription="Sube el reglamento, las actas y los manuales del condominio."
        scrollX={1100}
      />

      <FormDrawer
        open={formOpen}
        title="Subir documento"
        description="El archivo se almacena de forma privada en Supabase Storage."
        onClose={() => setFormOpen(false)}
        onSubmit={() => void submit()}
        submitting={upload.isPending}
        submitLabel="Subir"
        width={560}
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="Acceso controlado"
          description="Los documentos no son publicos. Se descargan mediante URLs firmadas temporales y las politicas RLS validan el acceso por condominio."
        />

        <form onSubmit={submit} noValidate>
          <Upload.Dragger
            fileList={fileList}
            beforeUpload={() => false}
            maxCount={1}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
            onChange={(info) => setFileList(info.fileList.slice(-1))}
            onRemove={() => setFileList([])}
            className="mb-4"
          >
            <p className="mb-2">
              <UploadIcon className="mx-auto text-slate-400" size={28} />
            </p>
            <p className="m-0 text-sm text-slate-700">
              Toca para elegir un archivo (o arrastralo en escritorio)
            </p>
            <p className="m-0 text-xs text-slate-500">PDF, Word, Excel, imagenes o texto. Maximo 25 MB.</p>
          </Upload.Dragger>

          <TextField control={form.control} name="title" label="Titulo" required />
          <TextAreaField control={form.control} name="description" label="Descripcion" rows={3} />

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="category_id"
              label="Categoria"
              allowClear
              loading={categoriesQuery.isLoading}
              options={(categoriesQuery.data ?? []).map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
            <SelectField
              control={form.control}
              name="visibility"
              label="Visibilidad"
              required
              options={toOptions(AUDIENCE_TYPE).filter((option) => option.value !== 'ROLE')}
            />
          </div>

          <SelectField
            control={form.control}
            name="building_id"
            label="Bloque (si aplica)"
            allowClear
            loading={buildingsQuery.isLoading}
            options={(buildingsQuery.data ?? []).map((building) => ({
              value: building.id,
              label: building.name,
            }))}
          />

          <SwitchField
            control={form.control}
            name="is_restricted"
            label="Solo administracion y voceros"
            help="Si se activa, los residentes no podran ver este documento."
          />
        </form>
      </FormDrawer>
    </>
  )
}
