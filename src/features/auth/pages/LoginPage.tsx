import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Card, Divider, Typography } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { TextField } from '@/components/forms/fields'
import { loginSchema, type LoginFormValues } from '@/schemas/auth'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/errors'

const { Title, Text } = Typography

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await signIn({ email: values.email, password: values.password })
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    }
  })

  return (
    <Card className="surface-card" styles={{ body: { padding: 28 } }}>
      <Title level={3} className="!mb-1">
        Iniciar sesion
      </Title>
      <Text type="secondary">Ingresa con tu cuenta para administrar tu condominio.</Text>

      {error ? (
        <Alert type="error" showIcon message={error} className="mt-4" closable onClose={() => setError(null)} />
      ) : null}

      <form onSubmit={onSubmit} className="mt-6" noValidate>
        <TextField
          control={control}
          name="email"
          label="Correo electronico"
          placeholder="tucorreo@dominio.com"
          type="email"
          required
          prefix={<Mail size={15} className="text-slate-400" />}
        />

        <TextField
          control={control}
          name="password"
          label="Contrasena"
          placeholder="Tu contrasena"
          type="password"
          required
          prefix={<Lock size={15} className="text-slate-400" />}
        />

        <div className="mb-4 flex justify-end">
          <Link to="/forgot-password" className="text-sm">
            Olvidaste tu contrasena?
          </Link>
        </div>

        <Button type="primary" htmlType="submit" block size="large" loading={isSubmitting}>
          Ingresar
        </Button>
      </form>

      <Divider plain className="!my-6">
        <span className="text-xs text-slate-400">o</span>
      </Divider>

      <div className="text-center">
        <Text type="secondary" className="text-sm">
          No tienes cuenta?{' '}
          <Link to="/register" className="font-medium">
            Registrate
          </Link>
        </Text>
      </div>
    </Card>
  )
}
