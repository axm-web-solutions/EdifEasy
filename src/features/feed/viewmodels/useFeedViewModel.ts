import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useModuleAccess } from '@/hooks/useModules'
import { useAnnouncementMutations, useFeed } from '@/hooks/useAnnouncements'
import { useAllBuildings } from '@/hooks/useBuildings'
import { useRoles } from '@/hooks/useMembers'
import { feedPostSchema, type FeedPostFormValues } from '@/schemas/communication'
import { roleLabel } from '@/constants/roles'
import { audienceLabel, greetingFor, toPostView } from './feed.logic'

const EMPTY_POST: FeedPostFormValues = {
  title: '',
  content: '',
  image_url: '',
  audience: 'CONDOMINIUM',
  building_id: null,
  audience_role_id: null,
  pinned: false,
}

const AUDIENCE_OPTIONS = [
  { value: 'CONDOMINIUM', label: 'Todo el conjunto' },
  { value: 'BUILDING', label: 'Un bloque o torre' },
  { value: 'ROLE', label: 'Un grupo (propietarios, arrendatarios...)' },
]

/** Roles a los que se puede dirigir una publicacion. */
const TARGETABLE_ROLES = [
  'OWNER',
  'TENANT',
  'SPOKESPERSON',
  'SECURITY',
  'SERVICE_STAFF',
  'ADMINISTRATOR',
]

/**
 * Feed del inicio: publicaciones de la administracion (comunicados) dirigidas a
 * todo el conjunto o a un grupo. La administracion y los voceros publican desde
 * aqui mismo; RLS entrega a cada persona solo lo que le corresponde.
 */
export function useFeedViewModel() {
  const { currentCondominiumId, currentMembership, profile, role, hasRole } = useAuth()
  const { isModuleEnabled } = useModuleAccess()

  const feedEnabled = isModuleEnabled('announcements')
  const canPost = feedEnabled && hasRole(['ADMINISTRATOR', 'SPOKESPERSON', 'SUPER_ADMIN'])
  const canDelete = feedEnabled && hasRole(['ADMINISTRATOR', 'SUPER_ADMIN'])

  const feedQuery = useFeed(feedEnabled ? currentCondominiumId : null)
  const mutations = useAnnouncementMutations()
  const buildingsQuery = useAllBuildings(canPost ? currentCondominiumId : null)
  const rolesQuery = useRoles()

  const posts = useMemo(
    () => (feedQuery.data?.pages ?? []).flatMap((page) => page.items).map(toPostView),
    [feedQuery.data],
  )

  // ---------------------------------------------------------------- composer
  const [composerOpen, setComposerOpen] = useState(false)
  const form = useForm<FeedPostFormValues>({
    resolver: zodResolver(feedPostSchema),
    defaultValues: EMPTY_POST,
  })
  const audience = useWatch({ control: form.control, name: 'audience' })

  const submitPost = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    mutations.create.mutate(
      {
        condominium_id: currentCondominiumId,
        title: values.title,
        content: values.content,
        image_url: values.image_url || null,
        audience: values.audience,
        building_id: values.audience === 'BUILDING' ? values.building_id || null : null,
        audience_role_id: values.audience === 'ROLE' ? values.audience_role_id || null : null,
        pinned: values.pinned,
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
        created_by: profile?.id ?? null,
      },
      {
        onSuccess: () => {
          form.reset(EMPTY_POST)
          setComposerOpen(false)
        },
      },
    )
  })

  let status: 'disabled' | 'loading' | 'error' | 'empty' | 'ready'
  if (!feedEnabled) status = 'disabled'
  else if (feedQuery.isLoading) status = 'loading'
  else if (feedQuery.isError) status = 'error'
  else if (posts.length === 0) status = 'empty'
  else status = 'ready'

  const firstName = profile?.full_name?.split(' ')[0] ?? 'vecino'

  return {
    greeting: greetingFor(firstName),
    subtitle: `${currentMembership?.condominium_name ?? 'Condominio'} · ${roleLabel(role)}`,
    status,
    posts,
    hasMore: Boolean(feedQuery.hasNextPage),
    loadingMore: feedQuery.isFetchingNextPage,
    loadMore: () => void feedQuery.fetchNextPage(),
    retry: () => void feedQuery.refetch(),

    composer: canPost
      ? {
          open: composerOpen,
          condominiumId: currentCondominiumId,
          setOpen: setComposerOpen,
          control: form.control,
          audience,
          audienceOptions: AUDIENCE_OPTIONS,
          buildingOptions: (buildingsQuery.data ?? []).map((building) => ({
            value: building.id,
            label: building.name,
          })),
          buildingsLoading: buildingsQuery.isLoading,
          roleOptions: (rolesQuery.data ?? [])
            .filter((item) => TARGETABLE_ROLES.includes(item.code))
            .map((item) => ({
              value: item.id,
              label: audienceLabel({
                audience: 'ROLE',
                building: null,
                audience_role: { id: item.id, code: item.code, name: item.name },
              }),
            })),
          rolesLoading: rolesQuery.isLoading,
          submit: submitPost,
          submitting: mutations.create.isPending,
          cancel: () => {
            form.reset(EMPTY_POST)
            setComposerOpen(false)
          },
        }
      : null,

    togglePin: canPost
      ? (id: string, pinned: boolean) =>
          mutations.update.mutate({ id, values: { pinned: !pinned } })
      : null,
    remove: canDelete ? (id: string) => mutations.remove.mutate(id) : null,
  }
}

export type FeedViewModel = ReturnType<typeof useFeedViewModel>
