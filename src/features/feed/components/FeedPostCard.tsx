import { Button, Card, Dropdown, Tag, Typography } from 'antd'
import { MoreHorizontal, Pin, PinOff, Trash2, Users } from 'lucide-react'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { formatDateTime, formatRelative } from '@/utils/format'
import type { FeedPostView } from '../viewmodels/feed.logic'

interface FeedPostCardProps {
  post: FeedPostView
  onTogglePin: ((id: string, pinned: boolean) => void) | null
  onRemove: ((id: string) => void) | null
}

/** Una publicacion del feed. */
export function FeedPostCard({ post, onTogglePin, onRemove }: FeedPostCardProps) {
  const actions = [
    onTogglePin
      ? {
          key: 'pin',
          icon: post.pinned ? <PinOff size={14} /> : <Pin size={14} />,
          label: post.pinned ? 'Quitar de fijados' : 'Fijar arriba',
          onClick: () => onTogglePin(post.id, post.pinned),
        }
      : null,
    onRemove
      ? {
          key: 'remove',
          danger: true,
          icon: <Trash2 size={14} />,
          label: 'Eliminar',
          onClick: async () => {
            const ok = await confirmDelete({
              title: 'Eliminar publicacion',
              content: 'La publicacion desaparece del feed de todos. No se puede deshacer.',
            })
            if (ok) onRemove(post.id)
          },
        }
      : null,
  ].filter((item) => item !== null)

  return (
    <Card size="small" className="surface-card" styles={{ body: { padding: 16 } }}>
      <article>
        <header className="flex items-start gap-3">
          <div
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800"
          >
            {post.authorInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-semibold text-slate-800">{post.authorName}</span>
              {post.pinned ? (
                <Tag bordered={false} color="gold" className="!m-0 inline-flex items-center gap-1">
                  <Pin size={12} /> Fijada
                </Tag>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <time dateTime={post.publishedAt} title={formatDateTime(post.publishedAt)}>
                {formatRelative(post.publishedAt)}
              </time>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                {post.audienceIsEveryone ? post.audience : `Para: ${post.audience}`}
              </span>
            </div>
          </div>
          {actions.length > 0 ? (
            <Dropdown menu={{ items: actions }} trigger={['click']} placement="bottomRight">
              <Button type="text" size="small" aria-label="Opciones de la publicacion" icon={<MoreHorizontal size={16} />} />
            </Dropdown>
          ) : null}
        </header>

        <h3 className="mb-1 mt-3 text-base font-semibold text-slate-900">{post.title}</h3>
        <Typography.Paragraph
          className="!mb-0 whitespace-pre-line text-sm text-slate-700"
          ellipsis={{ rows: 6, expandable: true, symbol: 'Ver mas' }}
        >
          {post.content}
        </Typography.Paragraph>

        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt=""
            loading="lazy"
            className="mt-3 max-h-96 w-full rounded-lg object-cover"
          />
        ) : null}
      </article>
    </Card>
  )
}
