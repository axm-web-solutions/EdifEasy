import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Card, Result, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { TextField } from '@/components/forms/fields'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/schemas/auth'
import { authService } from '@/services/authService'
import { getErrorMessage } from '@/lib/errors'

const { Title, Text } = Typography

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await authService.requestPasswordReset(values.email)
      setSent(true)
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    }
  })

  if (sent) {
    return (
      <Card className="surface-card">
        <Result
          status="success"
          title="Revisa tu correo"
          subTitle="Si el correo esta registrado, recibiras un enlace para restablecer tu contrasena. El enlace vence en 1 hora."
          extra={
            <Link to="/login">
              <Button type="primary">Volver a iniciar sesion</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <Card className="surface-card" styles={{ body: { padding: 28 } }}>
      <Title level={3} className="!mb-1">
        Recuperar contrasena
      </Title>
      <Text type="secondary">
        Ingresa tu correo y te enviaremos un enlace para restablecer tu contrasena.
      </Text>

      {error ? (
        <Alert type="error" showIcon message={error} className="mt-4" closable onClose={() => setError(null)} />
      ) : null}

      <form onSubmit={onSubmit} className="mt-6" noValidate>
        <TextField
          control={control}
          name="email"
          label="Correo electronico"
          type="email"
          required
          placeholder="tucorreo@dominio.com"
        />

        <Button type="primary" htmlType="submit" block size="large" loading={isSubmitting}>
          Enviar enlace
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
