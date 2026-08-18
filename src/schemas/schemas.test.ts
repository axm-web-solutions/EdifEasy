import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from './auth'
import { alertSchema } from './communication'
import { fineSchema, requestSchema } from './operations'
import { apartmentSchema, buildingSchema } from './structure'

describe('loginSchema', () => {
  it('acepta credenciales validas', () => {
    const result = loginSchema.safeParse({ email: 'admin@edifeasy.com', password: 'Secreta123' })
    expect(result.success).toBe(true)
  })

  it('rechaza correos invalidos', () => {
    const result = loginSchema.safeParse({ email: 'no-es-correo', password: 'Secreta123' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Correo electronico invalido')
    }
  })

  it('exige la contrasena', () => {
    const result = loginSchema.safeParse({ email: 'admin@edifeasy.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const base = {
    userType: 'OWNER' as const,
    fullName: 'Laura Cardenas',
    email: 'laura@edifeasy.com',
    phone: '',
    documentNumber: '',
    condominiumId: '00000000-0000-0000-0000-000000000001',
    buildingId: '00000000-0000-0000-0000-000000000002',
    apartmentId: '00000000-0000-0000-0000-000000000003',
    note: '',
    vehicles: [],
    password: 'Secreta123',
    confirmPassword: 'Secreta123',
    acceptTerms: true as const,
  }

  it('acepta un registro completo', () => {
    expect(registerSchema.safeParse(base).success).toBe(true)
  })

  it('rechaza contrasenas debiles', () => {
    const result = registerSchema.safeParse({ ...base, password: 'abc', confirmPassword: 'abc' })
    expect(result.success).toBe(false)
  })

  it('exige que las contrasenas coincidan', () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: 'Otra12345' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('confirmPassword'))).toBe(true)
    }
  })

  it('exige el tipo de usuario', () => {
    const { userType: _omitido, ...sinTipo } = base
    expect(registerSchema.safeParse(sinTipo).success).toBe(false)
  })

  it('solo permite autoregistrarse como propietario o arrendatario', () => {
    expect(registerSchema.safeParse({ ...base, userType: 'TENANT' }).success).toBe(true)
    expect(registerSchema.safeParse({ ...base, userType: 'BOTH' }).success).toBe(true)
    expect(registerSchema.safeParse({ ...base, userType: 'ADMINISTRATOR' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, userType: 'SECURITY' }).success).toBe(false)
  })

  it('exige condominio, edificio y apartamento', () => {
    expect(registerSchema.safeParse({ ...base, condominiumId: '' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, buildingId: '' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, apartmentId: '' }).success).toBe(false)
  })

  it('solo acepta identificadores existentes, no texto libre', () => {
    // Un numero escrito a mano nunca pasa: los tres campos son UUID de catalogo.
    expect(registerSchema.safeParse({ ...base, apartmentId: '101' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, buildingId: 'Torre 1' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, condominiumId: 'Mi conjunto' }).success).toBe(false)
  })

  it('valida la placa de los vehiculos declarados', () => {
    expect(
      registerSchema.safeParse({ ...base, vehicles: [{ plate: 'ABC123', type: 'CAR' }] }).success,
    ).toBe(true)
    expect(registerSchema.safeParse({ ...base, vehicles: [{ plate: 'A' }] }).success).toBe(false)
  })
})

describe('alertSchema', () => {
  const base = {
    title: 'Corte de agua programado',
    description: 'El servicio se suspendera el martes entre 8am y 2pm.',
    type: 'WATER' as const,
    priority: 'HIGH' as const,
    status: 'ACTIVE' as const,
    audience: 'CONDOMINIUM' as const,
    building_id: null,
    apartment_id: null,
    audience_role_id: null,
    start_at: '2026-08-16T10:00:00.000Z',
    end_at: null,
  }

  it('acepta una alerta dirigida a todo el condominio', () => {
    expect(alertSchema.safeParse(base).success).toBe(true)
  })

  it('exige el bloque cuando la audiencia es BUILDING', () => {
    const result = alertSchema.safeParse({ ...base, audience: 'BUILDING' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('building_id'))).toBe(true)
    }
  })

  it('exige el apartamento cuando la audiencia es APARTMENT', () => {
    const result = alertSchema.safeParse({ ...base, audience: 'APARTMENT' })
    expect(result.success).toBe(false)
  })

  it('rechaza titulos demasiado cortos', () => {
    const result = alertSchema.safeParse({ ...base, title: 'Hey' })
    expect(result.success).toBe(false)
  })
})

describe('requestSchema', () => {
  it('acepta una solicitud valida', () => {
    const result = requestSchema.safeParse({
      title: 'Goteo en el bano',
      description: 'Se presenta un goteo constante desde hace tres dias.',
      type: 'MAINTENANCE',
      priority: 'MEDIUM',
      status: 'OPEN',
      apartment_id: null,
      building_id: null,
      assigned_to: null,
    })
    expect(result.success).toBe(true)
  })

  it('rechaza descripciones demasiado cortas', () => {
    const result = requestSchema.safeParse({
      title: 'Goteo en el bano',
      description: 'corto',
      type: 'MAINTENANCE',
      priority: 'MEDIUM',
      status: 'OPEN',
    })
    expect(result.success).toBe(false)
  })
})

describe('fineSchema', () => {
  it('exige un apartamento valido', () => {
    const result = fineSchema.safeParse({
      apartment_id: 'no-es-uuid',
      reason: 'Ruido fuera de horario',
      amount: 150000,
      fine_date: '2026-08-01',
      status: 'PENDING',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza valores negativos', () => {
    const result = fineSchema.safeParse({
      apartment_id: '00000000-0000-0000-0000-000000000001',
      reason: 'Ruido fuera de horario',
      amount: -1,
      fine_date: '2026-08-01',
      status: 'PENDING',
    })
    expect(result.success).toBe(false)
  })
})

describe('schemas de estructura', () => {
  it('buildingSchema exige nombre e identificador', () => {
    expect(buildingSchema.safeParse({ name: '', number: '' }).success).toBe(false)
    expect(buildingSchema.safeParse({ name: 'Bloque A', number: 'A' }).success).toBe(true)
  })

  it('apartmentSchema exige un bloque valido', () => {
    expect(apartmentSchema.safeParse({ building_id: 'x', number: '101' }).success).toBe(false)
    expect(
      apartmentSchema.safeParse({
        building_id: '00000000-0000-0000-0000-000000000001',
        number: '101',
      }).success,
    ).toBe(true)
  })
})
