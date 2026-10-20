import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { trialService } from '@/services/trialService'
import { getErrorMessage } from '@/lib/errors'
import { hasTrialSignup } from '../trial.logic'

/**
 * Cuenta registrada para la prueba gratis (desde la landing) que aun no tiene
 * conjunto: crea el conjunto de prueba automaticamente y entra al dashboard.
 */
export function useTrialStartViewModel() {
  const { session, refreshContext, signOut } = useAuth()
  const navigate = useNavigate()
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined
  const isTrialSignup = hasTrialSignup(metadata)
  const condoName =
    isTrialSignup && typeof (metadata?.trial as Record<string, unknown>).condo_name === 'string'
      ? ((metadata?.trial as Record<string, unknown>).condo_name as string)
      : null

  const start = useMutation({
    mutationFn: () => trialService.start(),
    onSuccess: async () => {
      await refreshContext()
      navigate('/dashboard', { replace: true })
    },
  })

  // Se arranca una sola vez al llegar; el RPC es idempotente si se repite.
  const started = useRef(false)
  useEffect(() => {
    if (!isTrialSignup || started.current) return
    started.current = true
    start.mutate()
  }, [isTrialSignup, start])

  return {
    isTrialSignup,
    condoName,
    email: session?.user?.email ?? '',
    starting: start.isPending || (!start.isError && !start.isSuccess),
    error: start.isError ? getErrorMessage(start.error) : null,
    retry: () => start.mutate(),
    signOut: () => void signOut().then(() => navigate('/login', { replace: true })),
  }
}
