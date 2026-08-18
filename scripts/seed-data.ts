/**
 * Catalogo de usuarios de prueba: 12 cuentas que cubren los 7 roles.
 *
 * Se mantiene deliberadamente corto. Antes eran 24 (12 propietarios y 5
 * arrendatarios) y los apartamentos quedaban todos ocupados, asi que no habia
 * ninguno libre para probar el autoregistro.
 *
 * Es la unica fuente de verdad compartida entre `scripts/seed-users.ts`
 * (crea los usuarios en Supabase Auth) y `supabase/seed.sql`
 * (crea los datos de dominio y los enlaza por email).
 */

export interface SeedUser {
  email: string
  fullName: string
  phone: string
  documentNumber: string
  /** Rol de referencia; la asignacion real se hace en supabase/seed.sql */
  role:
    | 'SUPER_ADMIN'
    | 'ADMINISTRATOR'
    | 'SPOKESPERSON'
    | 'OWNER'
    | 'TENANT'
    | 'SECURITY'
    | 'SERVICE_STAFF'
}

const owners: SeedUser[] = Array.from({ length: 3 }, (_, index) => {
  const n = index + 1
  return {
    email: `propietario${n}@edifeasy.com`,
    fullName: `Propietario ${n} Restrepo`,
    phone: `+57 300 100 ${String(1000 + n).padStart(4, '0')}`,
    documentNumber: `10${String(100000 + n)}`,
    role: 'OWNER' as const,
  }
})

const tenants: SeedUser[] = Array.from({ length: 2 }, (_, index) => {
  const n = index + 1
  return {
    email: `arrendatario${n}@edifeasy.com`,
    fullName: `Arrendatario ${n} Gomez`,
    phone: `+57 301 200 ${String(2000 + n).padStart(4, '0')}`,
    documentNumber: `20${String(200000 + n)}`,
    role: 'TENANT' as const,
  }
})

export const SEED_USERS: SeedUser[] = [
  {
    email: 'superadmin@edifeasy.com',
    fullName: 'Sofia Nunez',
    phone: '+57 300 000 0001',
    documentNumber: '1000000001',
    role: 'SUPER_ADMIN',
  },
  {
    email: 'admin@edifeasy.com',
    fullName: 'Carlos Mejia',
    phone: '+57 300 000 0002',
    documentNumber: '1000000002',
    role: 'ADMINISTRATOR',
  },
  {
    email: 'vocero@edifeasy.com',
    fullName: 'Laura Cardenas',
    phone: '+57 300 000 0003',
    documentNumber: '1000000003',
    role: 'SPOKESPERSON',
  },
  {
    email: 'celador1@edifeasy.com',
    fullName: 'Jose Pineda',
    phone: '+57 300 000 0004',
    documentNumber: '1000000004',
    role: 'SECURITY',
  },
  {
    email: 'celador2@edifeasy.com',
    fullName: 'Marta Quintero',
    phone: '+57 300 000 0005',
    documentNumber: '1000000005',
    role: 'SECURITY',
  },
  {
    email: 'servicios1@edifeasy.com',
    fullName: 'Andres Rojas',
    phone: '+57 300 000 0006',
    documentNumber: '1000000006',
    role: 'SERVICE_STAFF',
  },
  {
    email: 'servicios2@edifeasy.com',
    fullName: 'Diana Salazar',
    phone: '+57 300 000 0007',
    documentNumber: '1000000007',
    role: 'SERVICE_STAFF',
  },
  ...owners,
  ...tenants,
]

export const DEFAULT_SEED_PASSWORD = 'EdiFeasy2024*'
