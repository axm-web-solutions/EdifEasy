/**
 * Inmobiliaria de prueba con datos ficticios.
 *
 *   pnpm seed:agency
 *
 * Crea (o actualiza, sin duplicar) "Inmobiliaria Horizonte (demo)":
 *   - Usuarios: administrador, 2 propietarios y 3 arrendatarios, con la clave
 *     SEED_DEFAULT_PASSWORD del .env.
 *   - Tienda publica en /i/inmobiliaria-demo.
 *   - 12 propiedades de distintos tipos con fotos (Unsplash, verificadas).
 *   - Portada de la tienda y propiedades ubicadas en el mapa.
 *   - 3 contratos con cobros de los ultimos 3 meses (unos pagados, otros
 *     pendientes y uno vencido) e interesados de ejemplo.
 *
 * No conecta cuenta Wompi: esa la pega cada inmobiliaria con sus llaves.
 * Usa la service role: solo se ejecuta desde la maquina del equipo.
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv()

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PASSWORD) {
  console.error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SEED_DEFAULT_PASSWORD en .env')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: 'tribuia' },
  auth: { autoRefreshToken: false, persistSession: false },
})

const SLUG = 'inmobiliaria-demo'

const USERS = [
  {
    key: 'admin',
    email: 'inmobiliaria.admin@edifeasy.com',
    name: 'Laura Restrepo',
    phone: '3105550101',
    role: 'ADMINISTRATOR',
  },
  {
    key: 'owner1',
    email: 'inmobiliaria.propietario1@edifeasy.com',
    name: 'Jorge Mendoza',
    phone: '3105550102',
    role: 'OWNER',
  },
  {
    key: 'owner2',
    email: 'inmobiliaria.propietario2@edifeasy.com',
    name: 'Patricia Gil',
    phone: '3105550103',
    role: 'OWNER',
  },
  {
    key: 'tenant1',
    email: 'inmobiliaria.arrendatario1@edifeasy.com',
    name: 'Camilo Rojas',
    phone: '3105550104',
    role: 'TENANT',
  },
  {
    key: 'tenant2',
    email: 'inmobiliaria.arrendatario2@edifeasy.com',
    name: 'Valentina Ortiz',
    phone: '3105550105',
    role: 'TENANT',
  },
  {
    key: 'tenant3',
    email: 'inmobiliaria.arrendatario3@edifeasy.com',
    name: 'Andres Pineda',
    phone: '3105550106',
    role: 'TENANT',
  },
] as const

type UserKey = (typeof USERS)[number]['key']

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=75&fm=jpg&fit=crop`

/** Fotos candidatas por tipo; se descartan las que no respondan. */
const PHOTOS = {
  apartment: [
    '1502672260266-1c1ef2d93688',
    '1522708323590-d24dbb6b0267',
    '1493809842364-78817add7ffb',
    '1484154218962-a197022b5858',
    '1505691938895-1758d7feb511',
    '1600607687939-ce8a6c25118c',
    '1600566753190-17f0baa2a6c3',
  ],
  house: [
    '1564013799919-ab600027ffc6',
    '1568605114967-8130f3a36994',
    '1570129477492-45c003edd2be',
    '1600596542815-ffad4c1539a9',
    '1600585154340-be6161a56a0c',
    '1512917774080-9991f1c4c750',
    '1449844908441-8829872d2607',
  ],
  office: ['1497366216548-37526070297c', '1497366811353-6870744d04b2'],
  store: ['1441986300917-64674bd600d8', '1604719312566-8912e9227c6a'],
  warehouse: ['1586528116311-ad8dd3c8310d', '1553413077-190dd305871c'],
  land: ['1500382017468-9049fed747ef', '1500076656116-558758c991c1'],
}

async function workingPhotos(ids: string[]): Promise<string[]> {
  const checks = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetch(photo(id), { method: 'HEAD' })
        return response.ok ? photo(id) : null
      } catch {
        return null
      }
    }),
  )
  return checks.filter((url): url is string => Boolean(url))
}

async function ensureUsers(): Promise<Record<UserKey, string>> {
  const existing = new Map<string, string>()
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const user of data.users) if (user.email) existing.set(user.email.toLowerCase(), user.id)
    if (data.users.length < 200) break
  }
  const ids = {} as Record<UserKey, string>
  for (const user of USERS) {
    const found = existing.get(user.email)
    if (found) {
      ids[user.key] = found
      console.log(`  ~ ya existe   ${user.email}`)
      continue
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.name, phone: user.phone },
    })
    if (error) throw new Error(`${user.email}: ${error.message}`)
    ids[user.key] = data.user.id
    console.log(`  + creado      ${user.email}`)
  }
  // El trigger crea el perfil; se completan nombre y telefono.
  for (const user of USERS) {
    await admin
      .from('profiles')
      .update({ full_name: user.name, phone: user.phone })
      .eq('id', ids[user.key])
  }
  return ids
}

async function ensureAgency(): Promise<string> {
  const { data: found } = await admin
    .from('condominiums')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle()
  const values = {
    name: 'Inmobiliaria Horizonte (demo)',
    kind: 'AGENCY',
    slug: SLUG,
    city: 'Bogota',
    country: 'Colombia',
    phone: '6017450000',
    email: 'contacto@horizonte-demo.co',
    description:
      'Inmobiliaria de prueba de EdiFeasy. Arriendo y venta de apartamentos, casas, locales y oficinas en Bogota y la Sabana. Atendemos de lunes a sabado.',
    status: 'ACTIVE',
    settings: { whatsapp: '3001234567', primaryColor: '#365959' },
  }
  if (found) {
    await admin.from('condominiums').update(values).eq('id', found.id)
    console.log('  ~ inmobiliaria actualizada')
    return found.id
  }
  const { data, error } = await admin.from('condominiums').insert(values).select('id').single()
  if (error) throw error
  console.log('  + inmobiliaria creada')
  return data.id
}

async function ensureMembers(agencyId: string, ids: Record<UserKey, string>) {
  const { data: roles } = await admin.from('roles').select('id, code')
  const roleId = (code: string) => roles?.find((role) => role.code === code)?.id
  for (const user of USERS) {
    const { error } = await admin
      .from('condominium_members')
      .upsert(
        {
          condominium_id: agencyId,
          user_id: ids[user.key],
          role_id: roleId(user.role),
          status: 'ACTIVE',
        },
        { onConflict: 'condominium_id,user_id,role_id' },
      )
    if (error) throw new Error(`miembro ${user.email}: ${error.message}`)
  }
  console.log('  + miembros y roles listos')
}

async function seedProperties(agencyId: string, ids: Record<UserKey, string>) {
  const { count } = await admin
    .from('agency_properties')
    .select('id', { count: 'exact', head: true })
    .eq('condominium_id', agencyId)
  if ((count ?? 0) > 0) {
    console.log(`  ~ ya hay ${count} propiedades: no se crean de nuevo`)
    return
  }

  const [apartment, house, office, store, warehouse, land] = await Promise.all([
    workingPhotos(PHOTOS.apartment),
    workingPhotos(PHOTOS.house),
    workingPhotos(PHOTOS.office),
    workingPhotos(PHOTOS.store),
    workingPhotos(PHOTOS.warehouse),
    workingPhotos(PHOTOS.land),
  ])
  console.log(
    `  · fotos verificadas: ${apartment.length + house.length + office.length + store.length + warehouse.length + land.length}`,
  )
  const pick = (list: string[], start: number, n = 4) =>
    list.length
      ? Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(start + i) % list.length])
      : []

  const base = { condominium_id: agencyId, is_published: true, status: 'AVAILABLE' }
  const properties = [
    {
      ...base,
      code: 'APT-101',
      title: 'Apartamento con balcon en Cedritos',
      property_type: 'APARTAMENTO',
      operation: 'RENT',
      rent_price: 2500000,
      admin_fee: 380000,
      city: 'Bogota',
      neighborhood: 'Cedritos',
      address: 'Calle 147 # 12-30, apto 502',
      stratum: 4,
      area_m2: 72,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      floor: 5,
      pets_allowed: true,
      amenities: ['Balcon', 'Gimnasio', 'Porteria 24 h'],
      description:
        'Apartamento iluminado con balcon, cocina abierta y vista a los cerros. Conjunto con gimnasio, salon comunal y porteria 24 horas. Cerca de la autopista y centros comerciales.',
      images: pick(apartment, 0),
      owner: 'owner1',
    },
    {
      ...base,
      code: 'APT-102',
      title: 'Apartaestudio amoblado en Chapinero',
      property_type: 'APARTAESTUDIO',
      operation: 'RENT',
      rent_price: 1650000,
      admin_fee: 220000,
      city: 'Bogota',
      neighborhood: 'Chapinero Alto',
      address: 'Carrera 4 # 57-12, apto 301',
      stratum: 5,
      area_m2: 38,
      bedrooms: 1,
      bathrooms: 1,
      parking: 0,
      floor: 3,
      furnished: true,
      amenities: ['Amoblado', 'Terraza comunal'],
      description:
        'Ideal para profesionales: totalmente amoblado, a pasos de la zona G y de universidades. Incluye internet.',
      images: pick(apartment, 2),
      owner: 'owner1',
    },
    {
      ...base,
      code: 'CASA-201',
      title: 'Casa campestre en Chia con jardin',
      property_type: 'CASA',
      operation: 'SALE',
      rent_price: null,
      sale_price: 980000000,
      admin_fee: 450000,
      city: 'Chia',
      neighborhood: 'Vereda Fonqueta',
      address: 'Km 2 via Chia-Cajica, casa 14',
      stratum: 5,
      area_m2: 240,
      bedrooms: 4,
      bathrooms: 4,
      parking: 2,
      amenities: ['Jardin', 'Chimenea', 'Conjunto cerrado'],
      description:
        'Casa en conjunto campestre con jardin privado, chimenea, estudio y cuarto de servicio. A 20 minutos de Bogota.',
      images: pick(house, 0),
      owner: 'owner2',
    },
    {
      ...base,
      code: 'CASA-202',
      title: 'Casa en conjunto en Suba',
      property_type: 'CASA',
      operation: 'BOTH',
      rent_price: 3400000,
      sale_price: 620000000,
      admin_fee: 290000,
      city: 'Bogota',
      neighborhood: 'Suba Pinar',
      address: 'Calle 132 # 104-20, casa 8',
      stratum: 4,
      area_m2: 120,
      bedrooms: 3,
      bathrooms: 3,
      parking: 2,
      pets_allowed: true,
      amenities: ['Patio', 'Parque infantil'],
      description:
        'Casa de tres niveles con patio, en conjunto con parque infantil y zonas verdes. Disponible para arriendo o venta.',
      images: pick(house, 2),
      owner: 'owner2',
    },
    {
      ...base,
      code: 'APT-103',
      title: 'Apartamento familiar en Modelia',
      property_type: 'APARTAMENTO',
      operation: 'RENT',
      rent_price: 1900000,
      admin_fee: 260000,
      city: 'Bogota',
      neighborhood: 'Modelia',
      address: 'Calle 24 # 75-40, apto 404',
      stratum: 4,
      area_m2: 68,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      floor: 4,
      amenities: ['Piscina', 'Salon comunal'],
      description:
        'Cerca al aeropuerto y a la Avenida Esperanza. Conjunto con piscina y salon comunal.',
      images: pick(apartment, 4),
      owner: 'owner1',
    },
    {
      ...base,
      code: 'APT-104',
      title: 'Penthouse con terraza en Rosales',
      property_type: 'APARTAMENTO',
      operation: 'SALE',
      rent_price: null,
      sale_price: 1850000000,
      admin_fee: 1200000,
      city: 'Bogota',
      neighborhood: 'Rosales',
      address: 'Carrera 5 # 72-10, PH',
      stratum: 6,
      area_m2: 210,
      bedrooms: 3,
      bathrooms: 4,
      parking: 3,
      floor: 12,
      amenities: ['Terraza', 'Jacuzzi', 'Deposito'],
      description:
        'Penthouse duplex con terraza de 60 m2, jacuzzi y vista panoramica. Edificio con seguridad 24 horas.',
      images: pick(apartment, 1),
      owner: 'owner2',
    },
    {
      ...base,
      code: 'LOC-301',
      title: 'Local comercial esquinero en Galerias',
      property_type: 'LOCAL',
      operation: 'RENT',
      rent_price: 4200000,
      admin_fee: 0,
      city: 'Bogota',
      neighborhood: 'Galerias',
      address: 'Calle 53 # 24-02',
      stratum: 4,
      area_m2: 85,
      bathrooms: 1,
      amenities: ['Esquinero', 'Alto trafico'],
      description:
        'Local esquinero con doble frente y alto flujo peatonal. Apto para comercio o restaurante.',
      images: pick(store, 0, 2),
      owner: 'owner1',
    },
    {
      ...base,
      code: 'OFI-401',
      title: 'Oficina en la Calle 93',
      property_type: 'OFICINA',
      operation: 'BOTH',
      rent_price: 3800000,
      sale_price: 720000000,
      admin_fee: 650000,
      city: 'Bogota',
      neighborhood: 'Chico Norte',
      address: 'Calle 93 # 13-24, ofi 702',
      stratum: 6,
      area_m2: 95,
      bathrooms: 2,
      parking: 2,
      floor: 7,
      amenities: ['Sala de juntas', 'Recepcion'],
      description:
        'Oficina remodelada con sala de juntas, dos banos y dos parqueaderos. Edificio con recepcion.',
      images: pick(office, 0, 2),
      owner: 'owner2',
    },
    {
      ...base,
      code: 'BOD-501',
      title: 'Bodega en zona industrial de Fontibon',
      property_type: 'BODEGA',
      operation: 'RENT',
      rent_price: 7500000,
      admin_fee: 0,
      city: 'Bogota',
      neighborhood: 'Fontibon',
      address: 'Carrera 106 # 15-50',
      area_m2: 600,
      bathrooms: 2,
      parking: 4,
      amenities: ['Altura 8 m', 'Muelle de carga'],
      description:
        'Bodega con muelle de carga, altura libre de 8 metros y oficinas. Facil acceso a la Calle 13.',
      images: pick(warehouse, 0, 2),
      owner: 'owner1',
    },
    {
      ...base,
      code: 'LOT-601',
      title: 'Lote para construir en Cajica',
      property_type: 'LOTE',
      operation: 'SALE',
      rent_price: null,
      sale_price: 420000000,
      admin_fee: 0,
      city: 'Cajica',
      neighborhood: 'Rio Grande',
      address: 'Vereda Rio Grande, lote 3',
      area_m2: 1200,
      description:
        'Lote plano con servicios publicos disponibles y licencia para vivienda campestre.',
      images: pick(land, 0, 2),
      owner: 'owner2',
    },
    {
      ...base,
      code: 'FIN-701',
      title: 'Finca de descanso en Anapoima',
      property_type: 'FINCA',
      operation: 'SALE',
      rent_price: null,
      sale_price: 760000000,
      admin_fee: 0,
      city: 'Anapoima',
      neighborhood: 'Vereda El Rosario',
      address: 'Km 4 via Anapoima-La Mesa',
      area_m2: 5000,
      bedrooms: 5,
      bathrooms: 4,
      parking: 4,
      pets_allowed: true,
      amenities: ['Piscina', 'Kiosco', 'BBQ'],
      description:
        'Finca con piscina, kiosco con BBQ y cinco habitaciones. Clima calido a dos horas de Bogota.',
      images: pick(house, 4),
      owner: 'owner2',
    },
    {
      ...base,
      code: 'APT-105',
      title: 'Apartamento en remodelacion (no publicado)',
      property_type: 'APARTAMENTO',
      operation: 'RENT',
      rent_price: 2100000,
      admin_fee: 300000,
      city: 'Bogota',
      neighborhood: 'Colina Campestre',
      address: 'Calle 138 # 55-20, apto 201',
      stratum: 4,
      area_m2: 60,
      bedrooms: 2,
      bathrooms: 2,
      parking: 1,
      is_published: false,
      status: 'INACTIVE',
      description: 'En remodelacion: disponible el proximo mes.',
      images: pick(apartment, 5, 2),
      owner: 'owner1',
    },
  ]

  const ownerNames: Record<string, string> = { owner1: 'Jorge Mendoza', owner2: 'Patricia Gil' }
  const rows = properties.map(({ owner, ...property }) => ({
    furnished: false,
    pets_allowed: false,
    amenities: [],
    ...property,
    owner_profile_id: ids[owner as UserKey],
    owner_name: ownerNames[owner],
    owner_phone: owner === 'owner1' ? '3105550102' : '3105550103',
  }))
  const { error } = await admin.from('agency_properties').insert(rows)
  if (error) throw new Error(`propiedades: ${error.message}`)
  console.log(`  + ${rows.length} propiedades`)
}

function monthStart(offset: number): string {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return date.toISOString().slice(0, 10)
}

async function seedLeases(agencyId: string, ids: Record<UserKey, string>) {
  const { count } = await admin
    .from('property_leases')
    .select('id', { count: 'exact', head: true })
    .eq('condominium_id', agencyId)
  if ((count ?? 0) > 0) {
    console.log('  ~ ya hay contratos: no se crean de nuevo')
    return
  }
  const { data: properties } = await admin
    .from('agency_properties')
    .select('id, code, rent_price, admin_fee')
    .eq('condominium_id', agencyId)
  const byCode = (code: string) => properties?.find((property) => property.code === code)

  const leases = [
    {
      code: 'APT-101',
      tenant: 'tenant1',
      name: 'Camilo Rojas',
      doc: '1020456789',
      phone: '3105550104',
      email: 'inmobiliaria.arrendatario1@edifeasy.com',
      due: 5,
    },
    {
      code: 'APT-102',
      tenant: 'tenant2',
      name: 'Valentina Ortiz',
      doc: '1032987654',
      phone: '3105550105',
      email: 'inmobiliaria.arrendatario2@edifeasy.com',
      due: 10,
    },
    {
      code: 'LOC-301',
      tenant: 'tenant3',
      name: 'Andres Pineda (Cafe La Esquina SAS)',
      doc: '901234567',
      phone: '3105550106',
      email: 'inmobiliaria.arrendatario3@edifeasy.com',
      due: 1,
    },
  ]
  for (const lease of leases) {
    const property = byCode(lease.code)
    if (!property) continue
    const { error } = await admin.from('property_leases').insert({
      condominium_id: agencyId,
      property_id: property.id,
      tenant_profile_id: ids[lease.tenant as UserKey],
      tenant_name: lease.name,
      tenant_document: lease.doc,
      tenant_phone: lease.phone,
      tenant_email: lease.email,
      start_date: monthStart(-3),
      monthly_rent: property.rent_price,
      admin_fee: property.admin_fee,
      due_day: lease.due,
      // Ley 820: sin deposito en vivienda; el local comercial si lo tiene.
      lease_use: lease.code.startsWith('LOC') ? 'COMERCIAL' : 'VIVIENDA',
      deposit: lease.code.startsWith('LOC') ? property.rent_price : null,
      notes: 'Contrato de prueba (datos ficticios).',
    })
    if (error) throw new Error(`contrato ${lease.code}: ${error.message}`)
  }
  console.log(`  + ${leases.length} contratos`)

  // Cobros de los dos meses anteriores y del actual.
  for (const offset of [-2, -1, 0]) {
    const { error } = await admin.rpc('generate_lease_charges', {
      p_condominium: agencyId,
      p_period: monthStart(offset),
    })
    if (error) throw new Error(`cobros: ${error.message}`)
  }

  // Meses anteriores pagados; el local debe el mes pasado (vencido).
  const { data: charges } = await admin
    .from('lease_charges')
    .select('id, period, property:agency_properties(code)')
    .eq('condominium_id', agencyId)
  const paid = (charges ?? []).filter(
    (charge: { period: string; property: { code: string } | { code: string }[] | null }) => {
      const code = Array.isArray(charge.property) ? charge.property[0]?.code : charge.property?.code
      if (charge.period === monthStart(-2)) return true
      return charge.period === monthStart(-1) && code !== 'LOC-301'
    },
  )
  for (const [index, charge] of paid.entries()) {
    await admin
      .from('lease_charges')
      .update({
        status: 'PAID',
        payment_method: index % 2 ? 'CASH' : 'TRANSFER',
        paid_at: new Date(`${charge.period}T15:00:00Z`).toISOString(),
      })
      .eq('id', charge.id)
  }
  console.log(`  + cobros de 3 meses (${paid.length} pagados, el resto pendiente)`)
}

async function seedLeads(agencyId: string) {
  const { count } = await admin
    .from('agency_leads')
    .select('id', { count: 'exact', head: true })
    .eq('condominium_id', agencyId)
  if ((count ?? 0) > 0) {
    console.log('  ~ ya hay interesados: no se crean de nuevo')
    return
  }
  const { data: properties } = await admin
    .from('agency_properties')
    .select('id, code')
    .eq('condominium_id', agencyId)
  const id = (code: string) => properties?.find((property) => property.code === code)?.id ?? null
  const now = new Date().toISOString()
  const leads = [
    {
      property_id: id('CASA-201'),
      name: 'Mariana Lopez',
      phone: '3205550201',
      email: 'mariana.demo@example.com',
      message: 'Me interesa la casa de Chia, ¿se puede visitar el sabado?',
      status: 'NEW',
    },
    {
      property_id: id('APT-105'),
      name: 'Felipe Cardenas',
      phone: '3205550202',
      email: null,
      message: 'Busco apartamento de 2 habitaciones en el norte.',
      status: 'NEW',
    },
    {
      property_id: id('OFI-401'),
      name: 'Constructora Demo SAS',
      phone: '6017450099',
      email: 'compras.demo@example.com',
      message: 'Queremos la oficina en arriendo por 2 anos.',
      status: 'CONTACTED',
    },
    {
      property_id: id('FIN-701'),
      name: 'Sandra Moreno',
      phone: '3205550204',
      email: null,
      message: '¿Aceptan permuta por apartamento en Bogota?',
      status: 'CLOSED',
    },
  ].map((lead) => ({ ...lead, condominium_id: agencyId, consent_at: now }))
  const { error } = await admin.from('agency_leads').insert(leads)
  if (error) throw new Error(`interesados: ${error.message}`)
  console.log(`  + ${leads.length} interesados`)
}

/** Coordenadas aproximadas de cada barrio (para el mapa de la tienda). */
const COORDS: Record<string, [number, number]> = {
  'APT-101': [4.7241, -74.0442],
  'APT-102': [4.6447, -74.0563],
  'CASA-201': [4.8772, -74.0711],
  'CASA-202': [4.7483, -74.1042],
  'APT-103': [4.6679, -74.1183],
  'APT-104': [4.6561, -74.0481],
  'LOC-301': [4.6421, -74.0752],
  'OFI-401': [4.6797, -74.0479],
  'BOD-501': [4.6782, -74.1419],
  'LOT-601': [4.9302, -74.0281],
  'FIN-701': [4.5497, -74.5361],
  'APT-105': [4.7331, -74.0642],
}

/** Version en ingles de cada propiedad (la tienda tiene selector ES / EN). */
const ENGLISH: Record<string, { title: string; description: string }> = {
  'APT-101': {
    title: 'Bright apartment with balcony in Cedritos',
    description:
      'Bright apartment with a balcony, open kitchen and mountain views. Building with gym, community room and 24/7 doorman. Close to the highway and shopping malls.',
  },
  'APT-102': {
    title: 'Furnished studio in Chapinero',
    description:
      'Ideal for professionals: fully furnished, steps from Zona G and universities. Internet included.',
  },
  'CASA-201': {
    title: 'Country house with garden in Chia',
    description:
      'House in a gated country community with private garden, fireplace, study and staff room. 20 minutes from Bogota.',
  },
  'CASA-202': {
    title: 'House in a gated community in Suba',
    description:
      'Three-story house with patio, in a community with playground and green areas. Available for rent or sale.',
  },
  'APT-103': {
    title: 'Family apartment in Modelia',
    description:
      'Close to the airport and Avenida Esperanza. Building with swimming pool and community room.',
  },
  'APT-104': {
    title: 'Penthouse with terrace in Rosales',
    description:
      'Duplex penthouse with a 60 m2 terrace, hot tub and panoramic views. Building with 24/7 security.',
  },
  'LOC-301': {
    title: 'Corner retail space in Galerias',
    description:
      'Corner unit with double frontage and high foot traffic. Suitable for retail or a restaurant.',
  },
  'OFI-401': {
    title: 'Office on Calle 93',
    description:
      'Renovated office with meeting room, two bathrooms and two parking spaces. Building with reception.',
  },
  'BOD-501': {
    title: 'Warehouse in the Fontibon industrial area',
    description:
      'Warehouse with loading dock, 8 m clear height and offices. Easy access to Calle 13.',
  },
  'LOT-601': {
    title: 'Building lot in Cajica',
    description: 'Flat lot with utilities available and a permit for a country home.',
  },
  'FIN-701': {
    title: 'Weekend country estate in Anapoima',
    description:
      'Estate with swimming pool, BBQ gazebo and five bedrooms. Warm weather two hours from Bogota.',
  },
}

const HERO_CANDIDATES = [
  '1600596542815-ffad4c1539a9',
  '1600585154340-be6161a56a0c',
  '1512917774080-9991f1c4c750',
  '1564013799919-ab600027ffc6',
]

/** Portada, frase y ubicacion de las propiedades (siempre se actualizan). */
async function ensureStoreDesign(agencyId: string) {
  const [hero] = await workingPhotos(HERO_CANDIDATES)
  const { data: agency } = await admin
    .from('condominiums')
    .select('settings')
    .eq('id', agencyId)
    .single()
  const settings = {
    ...((agency?.settings ?? {}) as Record<string, unknown>),
    store: {
      heroImage: hero ? hero.replace('w=1200', 'w=2000') : null,
      heroVideo: null,
      tagline: 'Encuentra tu proximo hogar en Bogota y la Sabana',
      taglineEn: 'Find your next home in Bogota and the Savanna',
      descriptionEn:
        'EdiFeasy demo agency. Apartments, houses, retail spaces and offices for rent and sale in Bogota and the Savanna. Open Monday to Saturday.',
    },
  }
  await admin.from('condominiums').update({ settings }).eq('id', agencyId)

  const { data: properties } = await admin
    .from('agency_properties')
    .select('id, code')
    .eq('condominium_id', agencyId)
  let located = 0
  let translated = 0
  let englishMissing = false
  for (const property of properties ?? []) {
    const coords = property.code ? COORDS[property.code] : undefined
    if (coords) {
      const { error } = await admin
        .from('agency_properties')
        .update({ latitude: coords[0], longitude: coords[1] })
        .eq('id', property.id)
      if (!error) located += 1
    }
    const english = property.code ? ENGLISH[property.code] : undefined
    if (english && !englishMissing) {
      const { error } = await admin
        .from('agency_properties')
        .update({ title_en: english.title, description_en: english.description })
        .eq('id', property.id)
      if (error) englishMissing = true
      else translated += 1
    }
  }
  console.log(`  + portada de la tienda y ${located} propiedades ubicadas en el mapa`)
  console.log(
    englishMissing
      ? '  ! sin textos en ingles: corre la migracion 20261106000000_tienda_bilingue y repite'
      : `  + ${translated} propiedades con titulo y descripcion en ingles`,
  )
}

/**
 * Gestion (migracion 20261107000000): mandatos con los propietarios, poliza y
 * condiciones de los contratos, y un gasto esperando aprobacion del dueno.
 */
async function ensureManagement(agencyId: string) {
  const { data: properties } = await admin
    .from('agency_properties')
    .select('id, code, owner_profile_id, owner_name, owner_phone')
    .eq('condominium_id', agencyId)
  const { error: probe } = await admin.from('management_agreements').select('id').limit(1)
  if (probe) {
    console.log('  ! sin mandatos: corre la migracion 20261107000000_inmobiliaria_gestion y repite')
    return
  }

  let agreements = 0
  for (const property of properties ?? []) {
    if (!property.owner_profile_id) continue
    const { data: existing } = await admin
      .from('management_agreements')
      .select('id')
      .eq('property_id', property.id)
      .eq('status', 'ACTIVE')
      .maybeSingle()
    if (existing) continue
    const { error } = await admin.from('management_agreements').insert({
      condominium_id: agencyId,
      property_id: property.id,
      owner_profile_id: property.owner_profile_id,
      owner_name: property.owner_name ?? 'Propietario demo',
      owner_document_type: 'CC',
      owner_document: '79000000',
      owner_phone: property.owner_phone,
      commission_pct: 10,
      charges_vat: true,
      vat_pct: 19,
      withholding_pct: 0,
      bank_name: 'Banco Demo',
      account_type: 'AHORROS',
      account_number: '000123456789',
      account_holder: property.owner_name ?? 'Propietario demo',
      notes: 'Mandato de prueba (datos ficticios).',
    })
    if (!error) agreements += 1
  }

  const policyEnd = new Date()
  policyEnd.setMonth(policyEnd.getMonth() + 11)
  const { data: leases } = await admin
    .from('property_leases')
    .select('id, property:agency_properties(code)')
    .eq('condominium_id', agencyId)
    .eq('status', 'ACTIVE')
  type LeaseRef = { id: string; property: { code: string } | { code: string }[] | null }
  for (const lease of (leases ?? []) as unknown as LeaseRef[]) {
    const code = Array.isArray(lease.property) ? lease.property[0]?.code : lease.property?.code
    const commercial = code?.startsWith('LOC') ?? false
    await admin
      .from('property_leases')
      .update({
        insurer: 'El Libertador (demo)',
        policy_number: `POL-${lease.id.slice(0, 6).toUpperCase()}`,
        policy_expires_at: policyEnd.toISOString().slice(0, 10),
        late_interest_pct: 1.5,
        ...(commercial
          ? { lease_use: 'COMERCIAL', notice_months: 6, increase_rule: 'IPC_PLUS', increase_points: 2 }
          : {}),
      })
      .eq('id', lease.id)
  }

  const apartment = (properties ?? []).find((property) => property.code === 'APT-101')
  if (apartment) {
    const { count } = await admin
      .from('property_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', apartment.id)
    if (!count) {
      await admin.from('property_expenses').insert({
        condominium_id: agencyId,
        property_id: apartment.id,
        description: 'Revision y ajuste del calentador (demo)',
        amount: 120000,
      })
    }
  }
  console.log(
    `  + ${agreements} mandatos nuevos, poliza en ${leases?.length ?? 0} contratos y un gasto por aprobar`,
  )
}

async function main() {
  console.log('\nInmobiliaria de prueba\n')
  const ids = await ensureUsers()
  const agencyId = await ensureAgency()
  await ensureMembers(agencyId, ids)
  await seedProperties(agencyId, ids)
  await seedLeases(agencyId, ids)
  await seedLeads(agencyId)
  await ensureStoreDesign(agencyId)
  await ensureManagement(agencyId)
  const origin = process.env.APP_URL ?? 'https://edifeasy.com'
  console.log(`\nListo. Tienda: ${origin}/i/${SLUG}`)
  console.log('Usuarios (clave SEED_DEFAULT_PASSWORD):')
  for (const user of USERS) console.log(`  ${user.role.padEnd(14)} ${user.email}`)
}

main().catch((error) => {
  console.error('\nError:', error instanceof Error ? error.message : error)
  process.exit(1)
})
