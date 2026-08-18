import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apartmentService } from '@/services/apartmentService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

export function useApartments(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.apartments.list(condominiumId ?? '', params),
    queryFn: () => apartmentService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useAllApartments(condominiumId: string | null) {
  return useQuery({
    queryKey: queryKeys.apartments.all(condominiumId ?? ''),
    queryFn: () => apartmentService.listAll(condominiumId as string),
    enabled: Boolean(condominiumId),
    staleTime: 120_000,
  })
}


export function useApartment(id: string | null) {
  return useQuery({
    queryKey: queryKeys.apartments.detail(id ?? ''),
    queryFn: () => apartmentService.getById(id as string),
    enabled: Boolean(id),
  })
}

export function useApartmentOwners(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.apartments.owners(apartmentId ?? ''),
    queryFn: () => apartmentService.owners(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}

export function useApartmentTenants(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.apartments.tenants(apartmentId ?? ''),
    queryFn: () => apartmentService.tenants(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}

export function useApartmentTimeline(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.apartments.timeline(apartmentId ?? ''),
    queryFn: () => apartmentService.timeline(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}

export function useApartmentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['apartments'] })
    void queryClient.invalidateQueries({ queryKey: ['buildings'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'apartments'>) => apartmentService.create(values),
    onSuccess: () => {
      notify.success('Apartamento creado correctamente')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'apartments'> }) =>
      apartmentService.update(id, values),
    onSuccess: () => {
      notify.success('Apartamento actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => apartmentService.remove(id),
    onSuccess: () => {
      notify.success('Apartamento eliminado')
      invalidate()
    },
  })

  const addOwner = useMutation({
    mutationFn: (values: TablesInsert<'apartment_owners'>) => apartmentService.addOwner(values),
    onSuccess: () => {
      notify.success('Propietario asignado')
      invalidate()
    },
  })

  const removeOwner = useMutation({
    mutationFn: (id: string) => apartmentService.removeOwner(id),
    onSuccess: () => {
      notify.success('Propietario removido')
      invalidate()
    },
  })

  const addTenant = useMutation({
    mutationFn: (values: TablesInsert<'apartment_tenants'>) => apartmentService.addTenant(values),
    onSuccess: () => {
      notify.success('Arrendatario asignado')
      invalidate()
    },
  })

  const removeTenant = useMutation({
    mutationFn: (id: string) => apartmentService.removeTenant(id),
    onSuccess: () => {
      notify.success('Arrendatario removido')
      invalidate()
    },
  })

  return { create, update, remove, addOwner, removeOwner, addTenant, removeTenant }
}
