import { Alert, Button, Drawer, Image, Input, Modal, Tag } from 'antd'
import {
  Archive,
  Check,
  CheckCircle2,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { formatDate } from '@/utils/format'
import type { ClassifiedsViewModel } from '../viewmodels/useClassifiedsViewModel'

/** Detalle de un clasificado: fotos, descripcion, contacto y acciones. */
export function ListingDetailDrawer({ vm }: { vm: ClassifiedsViewModel }) {
  const listing = vm.selected

  const reject = () => {
    if (!listing) return
    let note = ''
    Modal.confirm({
      title: 'No aprobar publicacion',
      okText: 'No aprobar',
      cancelText: 'Volver',
      okButtonProps: { danger: true },
      content: (
        <Input.TextArea
          rows={3}
          maxLength={500}
          placeholder="Motivo para el vecino (ej. faltan fotos, no se permite este tipo de venta)"
          onChange={(event) => (note = event.target.value)}
        />
      ),
      onOk: () => vm.reject(listing.id, note.trim() || null),
    })
  }

  return (
    <Drawer
      open={Boolean(listing)}
      onClose={vm.closeDetail}
      width={560}
      title={listing?.title ?? ''}
    >
      {listing ? (
        <div className="space-y-4">
          {listing.imageUrls.length > 0 ? (
            <Image.PreviewGroup>
              <div className="grid grid-cols-3 gap-2">
                {listing.imageUrls.map((url, index) => (
                  <Image
                    key={url}
                    src={url}
                    alt=""
                    className="aspect-square rounded-lg object-cover"
                    rootClassName={index === 0 ? 'col-span-3' : ''}
                    width="100%"
                    height={index === 0 ? 260 : 110}
                    style={{ objectFit: 'cover' }}
                  />
                ))}
              </div>
            </Image.PreviewGroup>
          ) : null}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Tag bordered={false} className="!m-0" style={{ color: listing.color }}>
                {listing.categoryLabel}
              </Tag>
              {listing.isMine || vm.isAdmin ? (
                <Tag color={listing.statusColor} className="!m-0">
                  {listing.statusLabel}
                </Tag>
              ) : null}
            </div>
            <p className="m-0 mt-2 text-2xl font-bold text-slate-900">{listing.priceLabel}</p>
            {listing.chips.length > 0 ? (
              <p className="m-0 mt-1 text-sm text-slate-600">{listing.chips.join(' · ')}</p>
            ) : null}
          </div>

          <p className="m-0 whitespace-pre-line text-sm text-slate-700">{listing.description}</p>

          <p className="m-0 text-xs text-slate-500">
            {listing.sellerLabel}
            {listing.publishedAt ? ` · publicado el ${formatDate(listing.publishedAt)}` : ''}
          </p>

          {listing.reviewNotes && (listing.isMine || vm.isAdmin) ? (
            <Alert
              type="info"
              showIcon
              message="Nota de la administracion"
              description={listing.reviewNotes}
            />
          ) : null}

          {!listing.isMine && (listing.callHref || listing.whatsappHref) ? (
            <div className="flex flex-wrap gap-2">
              {listing.whatsappHref ? (
                <Button
                  type="primary"
                  icon={<MessageCircle size={16} />}
                  href={listing.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escribir por WhatsApp
                </Button>
              ) : null}
              {listing.callHref ? (
                <Button icon={<Phone size={16} />} href={listing.callHref}>
                  Llamar
                </Button>
              ) : null}
            </div>
          ) : null}

          <p className="m-0 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            EdiFeasy es un portal de contacto entre vecinos: no vende, no cobra comisiones y no
            responde por lo publicado. Verifica antes de pagar.{' '}
            <Link to="/legal/marketplace" target="_blank" rel="noopener">
              Reglas del marketplace
            </Link>
          </p>

          {vm.seller ? (
            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
              <p className="m-0 mb-1 font-semibold text-slate-800">
                Registro del vendedor (Ley 1480, art. 53) · solo administracion
              </p>
              <p className="m-0">
                {vm.seller.name} · {vm.seller.document}
              </p>
              <p className="m-0">{vm.seller.address}</p>
              <p className="m-0">
                {[vm.seller.phone, vm.seller.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {listing.canReview ? (
              <>
                <Button
                  type="primary"
                  icon={<Check size={16} />}
                  onClick={() => vm.approve(listing.id)}
                >
                  Aprobar
                </Button>
                <Button danger icon={<X size={16} />} onClick={reject}>
                  No aprobar
                </Button>
              </>
            ) : null}
            {listing.canEdit ? (
              <Button icon={<Pencil size={16} />} onClick={() => vm.openEdit(listing)}>
                Editar
              </Button>
            ) : null}
            {listing.canMarkSold ? (
              <Button icon={<CheckCircle2 size={16} />} onClick={() => vm.markSold(listing)}>
                Marcar vendida
              </Button>
            ) : null}
            {listing.canRepublish ? (
              <Button icon={<RotateCcw size={16} />} onClick={() => vm.republish(listing)}>
                Volver a publicar
              </Button>
            ) : null}
            {listing.canArchive ? (
              <Button icon={<Archive size={16} />} onClick={() => vm.archive(listing)}>
                Archivar
              </Button>
            ) : null}
            {listing.canDelete ? (
              <Button
                danger
                icon={<Trash2 size={16} />}
                onClick={async () => {
                  const ok = await confirmDelete({
                    title: 'Eliminar publicacion',
                    content: 'Se borran la publicacion y sus fotos.',
                  })
                  if (ok) vm.remove(listing)
                }}
              >
                Eliminar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}
