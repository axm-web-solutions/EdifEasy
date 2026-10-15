import { useCallback, useState } from 'react'

/**
 * Estado del panel lateral de "crear / editar" que comparten las pantallas CRUD:
 * si esta abierto y que registro se esta editando (null = crear).
 */
export function useFormDrawerState<T>() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)

  const openCreate = useCallback(() => {
    setEditing(null)
    setOpen(true)
  }, [])

  const openEdit = useCallback((record: T) => {
    setEditing(record)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { open, editing, isEditing: editing !== null, openCreate, openEdit, close }
}

export type FormDrawerState<T> = ReturnType<typeof useFormDrawerState<T>>
