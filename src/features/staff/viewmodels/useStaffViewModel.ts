import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useStaffMutations, useStaffRoster, useStaffShifts } from '@/hooks/useStaff'
import { getErrorMessage } from '@/lib/errors'
import { staffCheckInSchema, type StaffCheckInFormValues } from '@/schemas/logbook'
import { buildBoard, durationLabel, myOpenShift, toHistory } from './staff.logic'

/** Historial de los ultimos 7 dias (mas las jornadas que sigan abiertas). */
function weekAgo() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 7)
  return start.toISOString()
}

const EMPTY: StaffCheckInFormValues = {
  mode: 'member',
  profile_id: null,
  name: '',
  role_label: '',
  notes: '',
}

/**
 * Ingreso y salida del personal. Cada persona del personal marca su propia
 * jornada; porteria y administracion ven quien esta en turno, quien no ha
 * llegado, y registran a otros (incluidos externos como jardineros).
 */
export function useStaffViewModel() {
  const { currentCondominiumId, hasRole, user } = useAuth()
  const canManage = hasRole(['ADMINISTRATOR', 'SECURITY', 'SUPER_ADMIN'])
  const canViewBoard = canManage || hasRole(['SPOKESPERSON'])
  const isStaff = hasRole(['SECURITY', 'SERVICE_STAFF', 'ADMINISTRATOR', 'SPOKESPERSON'])

  const [from] = useState(weekAgo)
  const rosterQuery = useStaffRoster(currentCondominiumId, canViewBoard)
  const shiftsQuery = useStaffShifts(currentCondominiumId, from)
  const { checkIn, checkOut } = useStaffMutations()

  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data])
  const board = useMemo(
    () => buildBoard(rosterQuery.data ?? [], shifts),
    [rosterQuery.data, shifts],
  )
  const history = useMemo(() => toHistory(shifts), [shifts])
  const mine = myOpenShift(shifts, user?.id ?? null)

  // ------------------------------------------------------------ formulario
  const [formOpen, setFormOpen] = useState(false)
  const form = useForm<StaffCheckInFormValues>({
    resolver: zodResolver(staffCheckInSchema),
    defaultValues: EMPTY,
  })
  const mode = useWatch({ control: form.control, name: 'mode' })

  const openForm = (profileId: string | null = null) => {
    form.reset({ ...EMPTY, profile_id: profileId, mode: 'member' })
    checkIn.reset()
    setFormOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    checkIn.mutate(
      {
        condominiumId: currentCondominiumId,
        profileId: values.mode === 'member' ? values.profile_id : null,
        name: values.mode === 'external' ? values.name : null,
        roleLabel: values.role_label || null,
        notes: values.notes || null,
      },
      { onSuccess: () => setFormOpen(false) },
    )
  })

  const loading = shiftsQuery.isLoading || (canViewBoard && rosterQuery.isLoading)
  const error = shiftsQuery.isError || (canViewBoard && rosterQuery.isError)

  return {
    status: loading ? 'loading' : error ? 'error' : 'ready',
    retry: () => {
      void shiftsQuery.refetch()
      if (canViewBoard) void rosterQuery.refetch()
    },
    canManage,
    canViewBoard,

    // jornada propia
    showSelf: isStaff,
    myShift: mine
      ? {
          id: mine.id,
          since: new Date(mine.check_in_at).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          duration: durationLabel(mine.check_in_at, null),
        }
      : null,
    checkInSelf: () => {
      if (currentCondominiumId) checkIn.mutate({ condominiumId: currentCondominiumId })
    },
    checkingIn: checkIn.isPending && !formOpen,

    // tablero
    onDuty: board.onDuty,
    absent: board.absent,
    history,

    checkOut: (shiftId: string) => checkOut.mutate({ shiftId }),
    checkingOut: checkOut.isPending ? checkOut.variables?.shiftId : null,
    checkInMember: (profileId: string) => {
      if (currentCondominiumId) checkIn.mutate({ condominiumId: currentCondominiumId, profileId })
    },

    // formulario (registrar a otra persona)
    formOpen,
    openForm,
    closeForm: () => setFormOpen(false),
    control: form.control,
    mode,
    setMode: (value: 'member' | 'external') => form.setValue('mode', value),
    memberOptions: board.absent.map((member) => ({
      value: member.profileId,
      label: `${member.name} · ${member.roleLabel}`,
    })),
    submit,
    submitting: checkIn.isPending && formOpen,
    submitError: checkIn.error && formOpen ? getErrorMessage(checkIn.error) : null,
  }
}

export type StaffViewModel = ReturnType<typeof useStaffViewModel>
