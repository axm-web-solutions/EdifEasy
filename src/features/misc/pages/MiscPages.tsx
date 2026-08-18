import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Result, Spin, Tag, Typography } from 'antd'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/errors'
import { registrationService } from '@/services/registrationService'
import type { SelfRegisterRole } from '@/schemas/auth'
import { formatDateTime } from '@/utils/format'
import { CompleteInscriptionForm } from '@/features/auth/components/CompleteInscriptionForm'

const { Paragraph, Text } = Typography

const REQUESTED_ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario / Dueno',
  TENANT: 'Arrendatario',
  BOTH: 'Propietario y arrendatario',
}

/**
 * Usuario autenticado que aun no pertenece a ningun condominio.
 *
 * Tiene cuatro estados:
 *   - eleccion guardada (autoregistro) -> la envia sola, sin volver a preguntar
 *   - sin solicitud                    -> muestra el formulario de inscripcion
 *   - solicitud PENDING                -> pantalla de espera (el admin aprueba)
 *   - solicitud REJECTED               -> motivo del rechazo y opcion de reintentar
 */
export function NoCondominiumPage() {
  const { profile, session, initializing, signOut, refreshContext } = useAuth()
  const navigate = useNavigate()
  const [defaultUserType, setDefaultUserType] = useState<SelfRegisterRole | undefined>()
  const [retrying, setRetrying] = useState(false)
  const [autoSending, setAutoSending] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)

  const request = useQuery({
    queryKey: ['my-registration-request', profile?.id],
    queryFn: () => registrationService.myRequest(),
    enabled: Boolean(profile?.id),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const pending = registrationService.loadPending()
    if (pending) setDefaultUserType(pending.userType)
  }, [])

  /*
   * Envio automatico.
   *
   * Quien se registra ya eligio condominio, edificio y apartamento: pedirlo otra
   * vez aqui era repetir el mismo formulario. Solo hacia falta esperar a tener
   * sesion, porque el RPC exige auth.uid(). El RPC es idempotente (upsert sobre
   * la solicitud PENDING), asi que reenviar no duplica nada.
   */
  const autoSentRef = useRef(false)
  // Se extraen para que las dependencias del efecto sean exactamente lo que usa.
  const { data: myRequest, isSuccess: requestLoaded, refetch: refetchRequest } = request

  useEffect(() => {
    if (autoSentRef.current || !requestLoaded) return

    // Ya hay solicitud registrada: el respaldo local no hace falta.
    if (myRequest) {
      registrationService.clearPending()
      return
    }

    const pending = registrationService.loadPending()
    if (!pending) return

    autoSentRef.current = true
    setAutoSending(true)
    registrationService
      .request(pending)
      .then(() => {
        registrationService.clearPending()
        return refetchRequest()
      })
      .catch((sendError) => {
        // Cae al formulario, con el motivo a la vista y los datos precargados.
        setAutoError(getErrorMessage(sendError))
      })
      .finally(() => setAutoSending(false))
  }, [requestLoaded, myRequest, refetchRequest])

  // Si la solicitud fue aprobada, el contexto ya tendra membresia activa.
  useEffect(() => {
    if (request.data?.status === 'APPROVED') {
      void refreshContext().then(() => navigate('/dashboard', { replace: true }))
    }
  }, [request.data?.status, refreshContext, navigate])

  const handleSubmitted = () => {
    setRetrying(false)
    void request.refetch()
  }

  const footer = (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4">
      <Text type="secondary" className="text-sm">
        Tu correo registrado es <Text code>{profile?.email}</Text>
      </Text>
      <Button
        danger
        onClick={() => {
          void signOut().then(() => navigate('/login', { replace: true }))
        }}
      >
        Cerrar sesion
      </Button>
    </div>
  )

  // Esta ruta vive fuera de ProtectedRoute (el usuario aun no tiene condominio),
  // asi que la sesion se valida aqui.
  if (!initializing && !session) {
    return <Navigate to="/login" replace />
  }

  if (initializing || request.isLoading || autoSending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Spin size="large" tip={autoSending ? 'Enviando tu solicitud...' : 'Consultando tu inscripcion...'}>
          <div className="h-24 w-24" />
        </Spin>
      </div>
    )
  }

  const current = request.data

  // --- Esperando aprobacion -------------------------------------------------
  if (current?.status === 'PENDING' && !retrying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="surface-card w-full max-w-xl">
          <Result
            status="info"
            title="Tu solicitud esta en revision"
            subTitle="La administracion del condominio debe aprobar tu inscripcion antes de darte acceso. Te llegara una notificacion cuando lo haga."
          />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Condominio">{current.condominium_name}</Descriptions.Item>
            <Descriptions.Item label="Edificio">{current.building_number}</Descriptions.Item>
            <Descriptions.Item label="Apartamento">{current.apartment_number}</Descriptions.Item>
            <Descriptions.Item label="Solicitado como">
              {REQUESTED_ROLE_LABEL[current.requested_role] ?? current.requested_role}
            </Descriptions.Item>
            <Descriptions.Item label="Estado">
              <Tag color="gold" bordered={false}>
                Pendiente de aprobacion
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Enviada">{formatDateTime(current.created_at)}</Descriptions.Item>
          </Descriptions>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => void request.refetch()} loading={request.isFetching}>
              Comprobar de nuevo
            </Button>
            <Button type="link" onClick={() => setRetrying(true)}>
              Corregir mi solicitud
            </Button>
          </div>

          {footer}
        </Card>
      </div>
    )
  }

  // --- Rechazada ------------------------------------------------------------
  if (current?.status === 'REJECTED' && !retrying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="surface-card w-full max-w-xl">
          <Result
            status="warning"
            title="Tu solicitud fue rechazada"
            subTitle={
              current.review_notes
                ? `Motivo indicado por la administracion: ${current.review_notes}`
                : 'La administracion no autorizo la inscripcion.'
            }
            extra={
              <Button type="primary" onClick={() => setRetrying(true)}>
                Enviar una nueva solicitud
              </Button>
            }
          />
          {footer}
        </Card>
      </div>
    )
  }

  // --- Sin solicitud, o corrigiendo ----------------------------------------
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="surface-card w-full max-w-xl">
        <Result
          status="info"
          title="Completa tu inscripcion"
          subTitle={
            <div className="space-y-3 text-left">
              <Paragraph className="!mb-0">
                Hola <Text strong>{profile?.full_name ?? 'usuario'}</Text>, elige tu condominio,
                edificio y apartamento de la lista.
              </Paragraph>
              <Paragraph className="!mb-0">
                La administracion revisara tu solicitud antes de habilitar tu acceso.
              </Paragraph>
            </div>
          }
        />
        {autoError ? (
          <Alert
            type="warning"
            showIcon
            className="mb-4"
            message="No pudimos enviar tu solicitud automaticamente"
            description={autoError}
          />
        ) : null}
        <div className="mt-2">
          <CompleteInscriptionForm
            defaultUserType={defaultUserType ?? current?.requested_role}
            onSubmitted={handleSubmitted}
          />
        </div>
        {footer}
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="Pagina no encontrada"
      subTitle="La direccion que buscas no existe o fue movida."
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Ir al dashboard
        </Button>
      }
    />
  )
}

