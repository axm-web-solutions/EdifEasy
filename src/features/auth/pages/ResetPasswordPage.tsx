import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Card, Result, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { TextField } from '@/components/forms/fields'
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/schemas/auth'
import { authService } from '@/services/authService'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'

const { Title, Text } = Typography

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null)

  useEffect(() => {
    // El enlace del correo abre la app con una sesion de recuperacion activa.
    supabase.auth
      .getSession()
      .then(({ data }) => setHasRecoverySession(Boolean(data.session)))
      .catch(() => setHasRecoverySession(false))
  }, [])

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await authService.updatePassword(values.password)
      setDone(true)
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    }
  })

  if (done) {
    return (
      <Card className="surface-card">
        <Result
          status="success"
          title="Contrasena actualizada"
          subTitle="Ya puedes ingresar con tu nueva contrasena."
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard', { replace: true })}>
              Ir al dashboard
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card className="surface-card" styles={{ body: { padding: 28 } }}>
      <Title level={3} className="!mb-1">
        Nueva contrasena
      </Title>
      <Text type="secondary">Define una contrasena segura para tu cuenta.</Text>

      {hasRecoverySession === false ? (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="Enlace no valido o expirado"
          description="Solicita un nuevo enlace de recuperacion desde la pantalla de inicio de sesion."
        />
      ) : null}

      {error ? (
        <Alert type="error" showIcon message={error} className="mt-4" closable onClose={() => setError(null)} />
      ) : null}

      <form onSubmit={onSubmit} className="mt-6" noValidate>
        <TextField
          control={control}
          name="password"
          label="Nueva contrasena"
          type="password"
          required
          help="Minimo 8 caracteres, con mayuscula, minuscula y numero."
        />
        <TextField
          control={control}
          name="confirmPassword"
          label="Confirmar contrasena"
          type="password"
          required
        />

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={isSubmitting}
          disabled={hasRecoverySession === false}
        >
          Actualizar contrasena
        </Button>
      </form>

      <div className="mt-5 text-center">
        <Link to="/login" className="text-sm">
          Volver a iniciar sesion
        </Link>
      </div>
    </Card>
  )
}
