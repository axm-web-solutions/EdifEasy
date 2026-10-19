import { Tag } from 'antd'
import { ImageOff } from 'lucide-react'
import type { ListingView } from '../viewmodels/classifieds.logic'

/** Tarjeta de un clasificado (grilla del marketplace). */
export function ListingCard({
  listing,
  showStatus,
  onOpen,
}: {
  listing: ListingView & { coverUrl: string | null }
  showStatus: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-card flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left shadow-card transition hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {listing.coverUrl ? (
          <img
            src={listing.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff size={32} />
          </div>
        )}
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ backgroundColor: listing.color }}
        >
          {listing.categoryLabel}
        </span>
        {showStatus ? (
          <Tag color={listing.statusColor} className="!absolute right-2 top-2 !m-0">
            {listing.statusLabel}
          </Tag>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-base font-bold text-slate-900">{listing.priceLabel}</span>
        <span className="line-clamp-2 text-sm font-medium text-slate-800">{listing.title}</span>
        {listing.chips.length > 0 ? (
          <span className="truncate text-xs text-slate-500">{listing.chips.join(' · ')}</span>
        ) : null}
        <span className="mt-auto truncate pt-1 text-xs text-slate-400">{listing.sellerLabel}</span>
      </div>
    </button>
  )
}
