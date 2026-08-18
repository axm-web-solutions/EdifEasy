import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Card, Checkbox, Divider, Form, Result, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { registerSchema, type RegisterFormValues } from '@/schemas/auth'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/lib/errors'
import { registrationService } from '@/services/registrationService'
import { OrganizationPicker } from '../components/OrganizationPicker'

const { Title, Text } = Typography

const USER_TYPE_OPTIONS = [
  { value: 'OWNER', label: 'Propietario / Dueno' },
  { value: 'TENANT', label: 'Arrendatario' },
  { value: 'BOTH', label: 'Propietario y arrendatario' },
]

const VEHICLE_TYPE_OPTIONS = [
  { value: 'CAR', label: 'Automovil' },
  { value: 'MOTORCYCLE', label: 'Motocicleta' },
  { value: 'BICYCLE', label: 'Bicicleta' },
  { value: 'TRUCK', label: 'Camioneta' },
  { value: 'OTHER', label: 'Otro' },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  /**
   * confirm -> hay que confirmar el correo; la solicitud se envia al entrar.
   * sent    -> cuenta creada Y solicitud enviada en el mismo paso.
   * ready   -> cuenta creada pero el envio fallo; se reintenta en /sin-condominio.
   */
  const [done, setDone] = useState<'confirm' | 'sent' | 'ready' | null>(null)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      userType: undefined,
      fullName: '',
      email: '',
      phone: '',
      documentNumber: '',
      condominiumId: '',
      buildingId: '',
      apartmentId: '',
      note: '',
      vehicles: [],
      password: '',
      confirmPassword: '',
      acceptTerms: true,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'vehicles' })
  const userType = watch('userType')

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const result = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        userType: values.userType,
        phone: values.phone || undefined,
        documentNumber: values.documentNumber || undefined,
      })

      const input = {
        condominiumId: values.condominiumId,
        buildingId: values.buildingId,
        apartmentId: values.apartmentId,
        userType: values.userType,
        vehicles: values.vehicles.filter((vehicle) => vehicle.plate.trim().length > 0),
        note: values.note || undefined,
      }

      // Se guarda siempre: es el respaldo si el envio no puede completarse ahora.
      registrationService.savePending(input)

      // Con la confirmacion de correo desactivada, signUp ya devuelve sesion y
      // el RPC (que exige auth.uid()) puede ejecutarse aqui mismo. Asi el
      // usuario no tiene que volver a elegir lo que acaba de elegir.
      if (result.needsConfirmation) {
        setDone('confirm')
        return
      }

      try {
        await registrationService.request(input)
        registrationService.clearPending()
        setDone('sent')
      } catch (requestError) {
        // La cuenta si quedo creada. Se avisa del motivo y se completa el envio
        // en /sin-condominio, donde se reintenta con los datos ya guardados.
        setError(getErrorMessage(requestError))
        setDone('ready')
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    }
  })

  if (done) {
    const RESULT_BY_STATE = {
      confirm: {
        title: 'Cuenta creada correctamente',
        subTitle:
          'Revisa tu correo para confirmar la cuenta. Al iniciar sesion enviaremos tu solicitud de inscripcion, y la administracion del condominio debera aprobarla antes de darte acceso.',
        action: 'Ir a iniciar sesion',
        to: '/login',
      },
      sent: {
        title: 'Solicitud enviada',
        subTitle:
          'Tu cuenta quedo creada y tu solicitud de inscripcion ya esta en revision. La administracion del condominio debe aprobarla para darte acceso; no tienes que volver a llenar nada.',
        action: 'Ver el estado de mi solicitud',
        to: '/sin-condominio',
      },
      ready: {
        title: 'Cuenta creada correctamente',
        subTitle:
          'Falta enviar tu solicitud de inscripcion. Conservamos lo que elegiste, asi que solo hay que confirmarlo.',
        action: 'Enviar mi solicitud',
        to: '/sin-condominio',
      },
    } as const

    const result = RESULT_BY_STATE[done]

    return (
      <Card className="surface-card">
        {error ? <Alert type="warning" showIcon message={error} className="mb-4" /> : null}
        <Result
          status="success"
          title={result.title}
          subTitle={result.subTitle}
          extra={
            <Button type="primary" onClick={() => navigate(result.to)}>
              {result.action}
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card className="surface-card" styles={{ body: { padding: 28 } }}>
      <Title level={3} className="!mb-1">
        Crear cuenta
      </Title>
      <Text type="secondary">
        Registra tus datos y elige tu apartamento. Tu solicitud pasara a revision de la
        administracion del condominio, que es quien autoriza el acceso.
      </Text>

      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          className="mt-4"
          closable
          onClose={() => setError(null)}
        />
      ) : null}

      <form onSubmit={onSubmit} className="mt-6" noValidate>
        <Divider
          plain
          orientation="left"
          className="!mt-0 !mb-4"
          style={{ color: '#64748b', fontSize: 12 }}
        >
          TU ORGANIZACION
        </Divider>

        <SelectField
          control={control}
          name="userType"
          label="Tipo de usuario"
          required
          placeholder="Selecciona tu tipo de usuario"
          showSearch={false}
          options={USER_TYPE_OPTIONS}
          help="Solo puedes autoregistrarte como propietario o arrendatario. Los roles administrativos los asigna la administracion."
        />

        <OrganizationPicker
          control={control}
          setValue={setValue}
          watch={watch}
          userType={userType ?? 'OWNER'}
        />

        <Divider plain orientation="left" className="!mb-4" style={{ color: '#64748b', fontSize: 12 }}>
          TUS DATOS
        </Divider>

        <TextField control={control} name="fullName" label="Nombre completo" required />
        <TextField control={control} name="email" label="Correo electronico" type="email" required />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField control={control} name="phone" label="Telefono" />
          <TextField control={control} name="documentNumber" label="Documento" />
        </div>

        <TextAreaField
          control={control}
          name="note"
          label="Mensaje para la administracion (opcional)"
          rows={2}
          maxLength={500}
          help="Util si necesitas aclarar algo sobre tu vinculo con el apartamento."
        />

        <Divider plain orientation="left" className="!mb-4" style={{ color: '#64748b', fontSize: 12 }}>
          VEHICULOS (OPCIONAL)
        </Divider>

        {fields.map((field, index) => (
          <div key={field.id} className="mb-2 rounded-lg border border-slate-100 p-3">
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <TextField
                control={control}
                name={`vehicles.${index}.plate`}
                label="Placa"
                placeholder="Ej: ABC123"
                required
              />
              <SelectField
                control={control}
                name={`vehicles.${index}.type`}
                label="Tipo"
                options={VEHICLE_TYPE_OPTIONS}
                placeholder="Automovil"
              />
            </div>
            <Button type="text" size="small" danger onClick={() => remove(index)}>
              Quitar vehiculo
            </Button>
          </div>
        ))}

        <Button
          type="dashed"
          block
          className="!mb-4"
          onClick={() => append({ plate: '', type: 'CAR' })}
        >
          + Agregar vehiculo
        </Button>

        <Divider plain orientation="left" className="!mb-4" style={{ color: '#64748b', fontSize: 12 }}>
          SEGURIDAD
        </Divider>

        <TextField
          control={control}
          name="password"
          label="Contrasena"
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

        <Controller
          control={control}
          name="acceptTerms"
          render={({ field, fieldState }) => (
            <Form.Item
              validateStatus={fieldState.error ? 'error' : undefined}
              help={fieldState.error?.message}
            >
              <Checkbox
                checked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
              >
                Acepto los terminos y condiciones y la politica de tratamiento de datos.
              </Checkbox>
            </Form.Item>
          )}
        />

        <Button type="primary" htmlType="submit" block size="large" loading={isSubmitting}>
          Crear cuenta y solicitar inscripcion
        </Button>
      </form>

      <div className="mt-5 text-center">
        <Text type="secondary" className="text-sm">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium">
            Inicia sesion
          </Link>
        </Text>
      </div>
    </Card>
  )
}
