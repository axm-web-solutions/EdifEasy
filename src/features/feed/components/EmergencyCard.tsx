import { Button, Card, Skeleton, Tooltip } from 'antd'
import { Ambulance, Flame, MessageCircle, Navigation, Pencil, Phone, Plus, Shield, Siren } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EmergencyLine } from '@/constants/directory'
import type { CommunityContactRow } from '@/types/database'
import type { EmergencyViewModel } from '../viewmodels/useEmergencyViewModel'
import type { EmergencyContactView } from '../viewmodels/feed.logic'

const TONE_ICON: Record<EmergencyLine['tone'], ReactNode> = {
  general: <Siren size={18} />,
  police: <Shield size={18} />,
  medical: <Ambulance size={18} />,
  fire: <Flame size={18} />,
  other: <Phone size={18} />,
}

const TONE_CLASS: Record<EmergencyLine['tone'], string> = {
  general: 'bg-red-600 text-white hover:bg-red-700',
  police: 'bg-blue-900 text-white hover:bg-blue-950',
  medical: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100',
  fire: 'bg-orange-50 text-orange-800 ring-1 ring-orange-200 hover:bg-orange-100',
  other: 'bg-slate-50 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100',
}

function ContactRow({
  contact,
  onEdit,
}: {
  contact: EmergencyContactView
  onEdit?: () => void
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800">{contact.name}</div>
        <div className="truncate text-xs text-slate-500">
          {contact.detail}
          {contact.phoneLabel ? ` · ${contact.phoneLabel}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onEdit ? (
          <Tooltip title="Editar">
            <Button type="text" size="small" aria-label={`Editar ${contact.name}`} icon={<Pencil size={14} />} onClick={onEdit} />
          </Tooltip>
        ) : null}
        {contact.whatsappHref ? (
          <Tooltip title="WhatsApp">
            <Button
              size="small"
              aria-label={`WhatsApp a ${contact.name}`}
              icon={<MessageCircle size={14} />}
              href={contact.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            />
          </Tooltip>
        ) : null}
        {contact.callHref ? (
          <Button size="small" type="primary" icon={<Phone size={14} />} href={contact.callHref}>
            Llamar
          </Button>
        ) : contact.directionsHref ? (
          <Button
            size="small"
            icon={<Navigation size={14} />}
            href={contact.directionsHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ir
          </Button>
        ) : null}
      </div>
    </li>
  )
}

interface EmergencyCardProps {
  vm: EmergencyViewModel
  onAdd: () => void
  onEdit: (contact: CommunityContactRow) => void
}

/** Numeros de emergencia con llamada directa. */
export function EmergencyCard({ vm, onAdd, onEdit }: EmergencyCardProps) {
  return (
    <Card
      className="surface-card"
      data-tour="emergency-card"
      title={
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Siren size={16} className="text-red-600" /> Emergencias
        </span>
      }
      extra={
        vm.canManage ? (
          <Button size="small" icon={<Plus size={14} />} onClick={onAdd}>
            Numero
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {vm.primaryLines.map((line) => (
          <a
            key={line.number}
            href={line.href}
            className={`flex min-h-16 flex-col justify-center rounded-xl px-3 py-2 no-underline transition ${TONE_CLASS[line.tone]}`}
            aria-label={`Llamar al ${line.number}, ${line.label}`}
          >
            <span className="flex items-center gap-2 text-xl font-bold leading-none">
              {TONE_ICON[line.tone]}
              {line.number}
            </span>
            <span className="mt-1 text-xs font-medium leading-tight opacity-90">{line.label}</span>
          </a>
        ))}
      </div>

      {vm.condoContacts.length > 0 ? (
        <section className="mt-4">
          <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Del conjunto
          </h4>
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.condoContacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onEdit={vm.canManage ? () => onEdit(contact.row) : undefined}
              />
            ))}
          </ul>
        </section>
      ) : vm.canManage ? (
        <p className="mb-0 mt-3 text-xs text-slate-500">
          Agrega el numero del cuadrante de policia, la porteria o la brigada del conjunto para que
          los residentes los tengan a un toque.
        </p>
      ) : null}

      {vm.loading ? (
        <Skeleton active paragraph={{ rows: 2 }} className="mt-4" />
      ) : vm.nearby.length > 0 ? (
        <section className="mt-4">
          <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {vm.nearbyTitle}
          </h4>
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {vm.nearby.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </ul>
        </section>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-brand-text">
          Otras lineas nacionales
        </summary>
        <ul className="m-0 mt-2 list-none space-y-1 p-0">
          {vm.otherLines.map((line) => (
            <li key={line.number} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-slate-800">{line.label}</span>
                <span className="block text-xs text-slate-500">{line.description}</span>
              </span>
              <Button size="small" href={line.href} icon={<Phone size={14} />}>
                {line.number}
              </Button>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  )
}
