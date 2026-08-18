import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { petService, residentService, vehicleService } from '@/services/residentService'
import { queryKeys } from '@/lib/queryKeys'
import { notify } from '@/lib/notify'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams } from '@/types/models'

// --- Residentes -------------------------------------------------------------
export function useResidents(condominiumId: string | null, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.residents.list(condominiumId ?? '', params),
    queryFn: () => residentService.list(condominiumId as string, params),
    enabled: Boolean(condominiumId),
  })
}

export function useResidentsByApartment(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.residents.byApartment(apartmentId ?? ''),
    queryFn: () => residentService.listByApartment(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}

export function useResidentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['residents'] })
    void queryClient.invalidateQueries({ queryKey: ['condominiums'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'residents'>) => residentService.create(values),
    onSuccess: () => {
      notify.success('Residente registrado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'residents'> }) =>
      residentService.update(id, values),
    onSuccess: () => {
      notify.success('Residente actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => residentService.remove(id),
    onSuccess: () => {
      notify.success('Residente eliminado')
      invalidate()
    },
  })

  return { create, update, remove }
}

// --- Vehiculos ---------------------------------------------------------------

export function useVehiclesByApartment(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.vehicles.byApartment(apartmentId ?? ''),
    queryFn: () => vehicleService.listByApartment(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}

export function useVehicleMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['vehicles'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'vehicles'>) => vehicleService.create(values),
    onSuccess: () => {
      notify.success('Vehiculo registrado')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'vehicles'> }) =>
      vehicleService.update(id, values),
    onSuccess: () => {
      notify.success('Vehiculo actualizado')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => vehicleService.remove(id),
    onSuccess: () => {
      notify.success('Vehiculo eliminado')
      invalidate()
    },
  })

  return { create, update, remove }
}

// --- Mascotas ----------------------------------------------------------------

export function usePetsByApartment(apartmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.pets.byApartment(apartmentId ?? ''),
    queryFn: () => petService.listByApartment(apartmentId as string),
    enabled: Boolean(apartmentId),
  })
}

export function usePetMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['pets'] })
  }

  const create = useMutation({
    mutationFn: (values: TablesInsert<'pets'>) => petService.create(values),
    onSuccess: () => {
      notify.success('Mascota registrada')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TablesUpdate<'pets'> }) =>
      petService.update(id, values),
    onSuccess: () => {
      notify.success('Mascota actualizada')
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => petService.remove(id),
    onSuccess: () => {
      notify.success('Mascota eliminada')
      invalidate()
    },
  })

  return { create, update, remove }
}
