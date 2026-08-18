-- ============================================================================
-- EdiFeasy :: Datos de prueba
-- ----------------------------------------------------------------------------
-- REQUISITO PREVIO:
--   1) Ejecutar `supabase/schema.sql`
--   2) Ejecutar `npm run seed`  (crea los usuarios en Supabase Auth)
--   3) Ejecutar ESTE archivo en el SQL Editor
--
-- Es idempotente: borra y recrea el condominio demo en cada ejecucion.
-- ============================================================================

do $$
declare
  v_condo            uuid;
  v_role_super       uuid;
  v_role_admin       uuid;
  v_role_spokes      uuid;
  v_role_owner       uuid;
  v_role_tenant      uuid;
  v_role_security    uuid;
  v_role_staff       uuid;

  v_superadmin       uuid;
  v_admin            uuid;
  v_spokesperson     uuid;
  v_security1        uuid;
  v_security2        uuid;
  v_staff1           uuid;
  v_staff2           uuid;

  v_buildings        uuid[] := '{}';
  v_apartments       uuid[] := '{}';
  v_building         uuid;
  v_apartment        uuid;
  v_profile          uuid;
  v_resident         uuid;
  v_conversation     uuid;
  v_request          uuid;
  v_purchase         uuid;
  v_cat_admin        uuid;
  v_cat_maint        uuid;
  v_cat_services     uuid;
  v_cat_security     uuid;
  v_cat_cleaning     uuid;
  v_doccat_legal     uuid;
  v_doccat_finance   uuid;
  v_doccat_manuals   uuid;

  v_apt_numbers      text[] := array['101', '102', '201', '202', '301'];
  v_block_names      text[] := array['Bloque A', 'Bloque B', 'Bloque C'];
  v_block_numbers    text[] := array['A', 'B', 'C'];
  i                  integer;
  j                  integer;
  k                  integer;
  v_idx              integer;
  v_amount           numeric;
begin
  -- --------------------------------------------------------------------------
  -- 0. Validaciones previas
  -- --------------------------------------------------------------------------
  select id into v_role_super    from tribuia.roles where code = 'SUPER_ADMIN';
  select id into v_role_admin    from tribuia.roles where code = 'ADMINISTRATOR';
  select id into v_role_spokes   from tribuia.roles where code = 'SPOKESPERSON';
  select id into v_role_owner    from tribuia.roles where code = 'OWNER';
  select id into v_role_tenant   from tribuia.roles where code = 'TENANT';
  select id into v_role_security from tribuia.roles where code = 'SECURITY';
  select id into v_role_staff    from tribuia.roles where code = 'SERVICE_STAFF';

  if v_role_super is null then
    raise exception 'No existe el catalogo de roles. Ejecuta primero supabase/schema.sql';
  end if;

  select id into v_superadmin   from tribuia.profiles where lower(email) = 'superadmin@edifeasy.com';
  select id into v_admin        from tribuia.profiles where lower(email) = 'admin@edifeasy.com';
  select id into v_spokesperson from tribuia.profiles where lower(email) = 'vocero@edifeasy.com';
  select id into v_security1    from tribuia.profiles where lower(email) = 'celador1@edifeasy.com';
  select id into v_security2    from tribuia.profiles where lower(email) = 'celador2@edifeasy.com';
  select id into v_staff1       from tribuia.profiles where lower(email) = 'servicios1@edifeasy.com';
  select id into v_staff2       from tribuia.profiles where lower(email) = 'servicios2@edifeasy.com';

  if v_superadmin is null or v_admin is null then
    raise exception
      'No se encontraron los perfiles de prueba. Ejecuta primero: npm run seed (crea los usuarios en Supabase Auth)';
  end if;

  -- --------------------------------------------------------------------------
  -- 1. Limpieza del condominio demo (idempotencia)
  -- --------------------------------------------------------------------------
  delete from tribuia.condominiums where nit = '900123456-7';

  -- --------------------------------------------------------------------------
  -- 2. Rol global SUPER_ADMIN
  -- --------------------------------------------------------------------------
  insert into tribuia.user_roles (user_id, role_id)
  values (v_superadmin, v_role_super)
  on conflict (user_id, role_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 3. Condominio
  -- --------------------------------------------------------------------------
  insert into tribuia.condominiums
    (name, nit, address, city, country, phone, email, description, status, created_by)
  values
    ('Conjunto Residencial Altos del Parque',
     '900123456-7',
     'Calle 127 # 45-32',
     'Bogota',
     'Colombia',
     '+57 601 555 0100',
     'administracion@altosdelparque.com',
     'Conjunto residencial de 3 bloques y 15 apartamentos con zonas comunes, parqueadero y salon social.',
     'ACTIVE',
     v_superadmin)
  returning id into v_condo;

  -- --------------------------------------------------------------------------
  -- 4. Membresias (multi-tenancy)
  -- --------------------------------------------------------------------------
  insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position) values
    (v_condo, v_admin,        v_role_admin,    'ACTIVE', 'Administrador General'),
    (v_condo, v_spokesperson, v_role_spokes,   'ACTIVE', 'Vocero del Consejo'),
    (v_condo, v_security1,    v_role_security, 'ACTIVE', 'Celador turno dia'),
    (v_condo, v_security2,    v_role_security, 'ACTIVE', 'Celador turno noche'),
    (v_condo, v_staff1,       v_role_staff,    'ACTIVE', 'Mantenimiento'),
    (v_condo, v_staff2,       v_role_staff,    'ACTIVE', 'Aseo y zonas comunes');

  for i in 1..12 loop
    select id into v_profile from tribuia.profiles
      where lower(email) = 'propietario' || i || '@edifeasy.com';
    if v_profile is not null then
      insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
      values (v_condo, v_profile, v_role_owner, 'ACTIVE')
      on conflict do nothing;
    end if;
  end loop;

  for i in 1..5 loop
    select id into v_profile from tribuia.profiles
      where lower(email) = 'arrendatario' || i || '@edifeasy.com';
    if v_profile is not null then
      insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
      values (v_condo, v_profile, v_role_tenant, 'ACTIVE')
      on conflict do nothing;
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 5. Bloques (3)
  -- --------------------------------------------------------------------------
  for i in 1..3 loop
    insert into tribuia.buildings (condominium_id, name, number, description, floors, status)
    values (v_condo, v_block_names[i], v_block_numbers[i],
            'Bloque residencial con 5 apartamentos distribuidos en 3 pisos.', 3, 'ACTIVE')
    returning id into v_building;
    v_buildings := array_append(v_buildings, v_building);
  end loop;

  -- --------------------------------------------------------------------------
  -- 6. Apartamentos (15)
  -- --------------------------------------------------------------------------
  for i in 1..3 loop
    for j in 1..5 loop
      insert into tribuia.apartments
        (condominium_id, building_id, number, floor, area, bedrooms, bathrooms,
         parking_spots, coefficient, status, description)
      values (
        v_condo,
        v_buildings[i],
        v_block_numbers[i] || v_apt_numbers[j],
        left(v_apt_numbers[j], 1)::int,
        62.5 + (j * 7.5),
        case when j <= 2 then 2 else 3 end,
        case when j <= 2 then 1 else 2 end,
        case when j = 5 then 2 else 1 end,
        round((100.0 / 15)::numeric, 5),
        'VACANT',
        'Apartamento ' || v_block_numbers[i] || v_apt_numbers[j] || ' del ' || v_block_names[i]
      )
      returning id into v_apartment;
      v_apartments := array_append(v_apartments, v_apartment);
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 7. Propietarios (12 propietarios, 3 de ellos con 2 apartamentos)
  -- --------------------------------------------------------------------------
  for i in 1..15 loop
    v_idx := case when i <= 12 then i else i - 12 end;
    select id into v_profile from tribuia.profiles
      where lower(email) = 'propietario' || v_idx || '@edifeasy.com';
    if v_profile is not null then
      insert into tribuia.apartment_owners
        (apartment_id, profile_id, ownership_percentage, is_primary, start_date, is_active)
      values (v_apartments[i], v_profile, 100, i <= 12, current_date - (i * 30), true)
      on conflict (apartment_id, profile_id) do nothing;

      insert into tribuia.residents
        (condominium_id, apartment_id, profile_id, full_name, document_number,
         relationship, phone, email, is_active)
      select v_condo, v_apartments[i], p.id, p.full_name, p.document_number,
             'OWNER', p.phone, p.email, true
      from tribuia.profiles p where p.id = v_profile;
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 8. Arrendatarios (5) sobre los apartamentos 11..15
  -- --------------------------------------------------------------------------
  for i in 1..5 loop
    select id into v_profile from tribuia.profiles
      where lower(email) = 'arrendatario' || i || '@edifeasy.com';
    if v_profile is not null then
      v_apartment := v_apartments[10 + i];

      insert into tribuia.apartment_tenants
        (apartment_id, profile_id, lease_start, lease_end, monthly_rent, is_active)
      values (v_apartment, v_profile, current_date - 180, current_date + 185, 1800000 + (i * 100000), true)
      on conflict (apartment_id, profile_id) do nothing;

      insert into tribuia.residents
        (condominium_id, apartment_id, profile_id, full_name, document_number,
         relationship, phone, email, is_active)
      select v_condo, v_apartment, p.id, p.full_name, p.document_number,
             'TENANT', p.phone, p.email, true
      from tribuia.profiles p where p.id = v_profile;
    end if;
  end loop;

  -- Apartamentos ocupados
  update tribuia.apartments set status = 'OCCUPIED' where condominium_id = v_condo;
  update tribuia.apartments set status = 'MAINTENANCE' where id = v_apartments[9];
  update tribuia.apartments set status = 'VACANT' where id = v_apartments[4];

  -- --------------------------------------------------------------------------
  -- 9. Residentes adicionales (familiares sin cuenta de usuario)
  -- --------------------------------------------------------------------------
  for i in 1..15 loop
    if i % 2 = 0 then
      insert into tribuia.residents
        (condominium_id, apartment_id, full_name, document_number, relationship,
         birth_date, phone, is_active)
      values (v_condo, v_apartments[i],
              'Familiar ' || i || ' Torres',
              '3' || lpad(i::text, 9, '0'),
              'FAMILY',
              date '1995-01-01' + (i * 90),
              '+57 310 400 ' || lpad(i::text, 4, '0'),
              true);
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 10. Vehiculos y mascotas
  -- --------------------------------------------------------------------------
  for i in 1..15 loop
    insert into tribuia.vehicles
      (condominium_id, apartment_id, type, brand, model, color, plate, parking_spot, is_active)
    values (
      v_condo, v_apartments[i],
      case when i % 4 = 0 then 'MOTORCYCLE'::tribuia.vehicle_type else 'CAR'::tribuia.vehicle_type end,
      (array['Renault', 'Mazda', 'Chevrolet', 'Toyota', 'Nissan'])[1 + (i % 5)],
      (array['Logan', 'CX-30', 'Onix', 'Corolla', 'Kicks'])[1 + (i % 5)],
      (array['Blanco', 'Gris', 'Negro', 'Rojo', 'Azul'])[1 + (i % 5)],
      'ABC' || lpad(i::text, 3, '0'),
      'P-' || lpad(i::text, 3, '0'),
      true
    );

    if i % 3 = 0 then
      insert into tribuia.pets
        (condominium_id, apartment_id, name, type, breed, color, weight, vaccinated)
      values (v_condo, v_apartments[i],
              (array['Luna', 'Rocky', 'Nube', 'Kira', 'Toby'])[1 + (i % 5)],
              case when i % 6 = 0 then 'CAT'::tribuia.pet_type else 'DOG'::tribuia.pet_type end,
              (array['Criollo', 'Labrador', 'Poodle', 'Siames', 'Beagle'])[1 + (i % 5)],
              'Cafe', 8.5 + i, true);
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 11. Categorias de gasto + gastos (6 meses)
  -- --------------------------------------------------------------------------
  insert into tribuia.expense_categories (condominium_id, name, code, color, description) values
    (v_condo, 'Administracion', 'ADM', '#2559eb', 'Honorarios y gastos administrativos'),
    (v_condo, 'Mantenimiento',  'MTO', '#f59e0b', 'Mantenimiento preventivo y correctivo'),
    (v_condo, 'Servicios publicos', 'SPU', '#10b981', 'Agua, energia, gas e internet'),
    (v_condo, 'Seguridad',      'SEG', '#ef4444', 'Vigilancia y control de acceso'),
    (v_condo, 'Aseo',           'ASE', '#8b5cf6', 'Aseo y zonas comunes');

  select id into v_cat_admin    from tribuia.expense_categories where condominium_id = v_condo and name = 'Administracion';
  select id into v_cat_maint    from tribuia.expense_categories where condominium_id = v_condo and name = 'Mantenimiento';
  select id into v_cat_services from tribuia.expense_categories where condominium_id = v_condo and name = 'Servicios publicos';
  select id into v_cat_security from tribuia.expense_categories where condominium_id = v_condo and name = 'Seguridad';
  select id into v_cat_cleaning from tribuia.expense_categories where condominium_id = v_condo and name = 'Aseo';

  for i in 0..5 loop
    insert into tribuia.expenses
      (condominium_id, category_id, concept, provider, amount, expense_date, invoice_number, description, status, created_by)
    values
      (v_condo, v_cat_admin, 'Honorarios administracion',
       'Gestion Inmobiliaria SAS', 3200000 + (i * 45000),
       (date_trunc('month', current_date) - make_interval(months => i))::date + 4,
       'FA-ADM-' || to_char(current_date - make_interval(months => i), 'YYYYMM'),
       'Honorarios mensuales de administracion', 'PAID', v_admin),
      (v_condo, v_cat_services, 'Servicios publicos zonas comunes',
       'Empresa de Energia', 1850000 + (i * 63000),
       (date_trunc('month', current_date) - make_interval(months => i))::date + 8,
       'FA-SPU-' || to_char(current_date - make_interval(months => i), 'YYYYMM'),
       'Consumo de energia y agua en zonas comunes', 'PAID', v_admin),
      (v_condo, v_cat_security, 'Vigilancia 24/7',
       'Seguridad Andina Ltda', 5400000 + (i * 30000),
       (date_trunc('month', current_date) - make_interval(months => i))::date + 10,
       'FA-SEG-' || to_char(current_date - make_interval(months => i), 'YYYYMM'),
       'Servicio de vigilancia con dos puestos', 'PAID', v_admin),
      (v_condo, v_cat_cleaning, 'Aseo zonas comunes',
       'Brillante SAS', 1650000 + (i * 21000),
       (date_trunc('month', current_date) - make_interval(months => i))::date + 12,
       'FA-ASE-' || to_char(current_date - make_interval(months => i), 'YYYYMM'),
       'Aseo diario de pasillos, ascensores y salon social', 'PAID', v_admin);

    if i % 2 = 0 then
      insert into tribuia.expenses
        (condominium_id, category_id, concept, provider, amount, expense_date, invoice_number, description, status, created_by)
      values (v_condo, v_cat_maint, 'Mantenimiento ascensores',
              'Ascensores Delta', 2100000 + (i * 90000),
              (date_trunc('month', current_date) - make_interval(months => i))::date + 16,
              'FA-MTO-' || to_char(current_date - make_interval(months => i), 'YYYYMM'),
              'Mantenimiento preventivo de los 3 ascensores',
              case when i = 0 then 'PENDING'::tribuia.expense_status else 'PAID'::tribuia.expense_status end, v_admin);
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 12. Compras + items
  -- --------------------------------------------------------------------------
  for i in 1..4 loop
    insert into tribuia.purchases
      (condominium_id, provider, purchase_date, status, invoice_number, notes, created_by)
    values (
      v_condo,
      (array['Ferreteria El Tornillo', 'Suministros Aseo Total', 'Jardines Verdes', 'Electricos JM'])[i],
      (current_date - (i * 21)),
      (array['RECEIVED', 'RECEIVED', 'ORDERED', 'DRAFT'])[i]::tribuia.purchase_status,
      'CP-' || lpad(i::text, 5, '0'),
      'Compra de insumos para mantenimiento y zonas comunes.',
      v_admin
    )
    returning id into v_purchase;

    for j in 1..3 loop
      insert into tribuia.purchase_items (purchase_id, product, description, quantity, unit_price)
      values (
        v_purchase,
        (array['Bombillo LED 12W', 'Detergente industrial 5L', 'Manguera 20m',
               'Cinta aislante', 'Guantes de trabajo', 'Pintura blanca galon',
               'Tornillos surtidos', 'Escoba industrial', 'Fertilizante 10kg',
               'Cable encauchetado 3x12', 'Interruptor doble', 'Tomacorriente'])[((i - 1) * 3) + j],
        'Insumo requerido para mantenimiento de zonas comunes',
        (j * 5) + i,
        12000 + (j * 8500) + (i * 1200)
      );
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 13. Alertas
  -- --------------------------------------------------------------------------
  insert into tribuia.alerts
    (condominium_id, building_id, apartment_id, title, description, type, priority, status,
     audience, start_at, end_at, created_by)
  values
    (v_condo, null, null, 'Corte programado de agua',
     'El proximo martes se realizara mantenimiento del tanque principal. El servicio de agua se suspendera de 8:00 a.m. a 2:00 p.m.',
     'WATER', 'HIGH', 'ACTIVE', 'CONDOMINIUM', now() - interval '2 days', now() + interval '5 days', v_admin),
    (v_condo, null, null, 'Simulacro de evacuacion',
     'Se realizara un simulacro de evacuacion este viernes a las 10:00 a.m. La participacion es obligatoria.',
     'EMERGENCY', 'CRITICAL', 'ACTIVE', 'CONDOMINIUM', now() - interval '1 day', now() + interval '10 days', v_spokesperson),
    (v_condo, v_buildings[1], null, 'Mantenimiento del ascensor - Bloque A',
     'El ascensor del Bloque A estara fuera de servicio el jueves entre 7:00 a.m. y 12:00 m.',
     'MAINTENANCE', 'MEDIUM', 'ACTIVE', 'BUILDING', now(), now() + interval '7 days', v_admin),
    (v_condo, null, null, 'Refuerzo de seguridad en porteria',
     'Se implementa registro obligatorio de visitantes con documento de identidad.',
     'SECURITY', 'MEDIUM', 'ACTIVE', 'CONDOMINIUM', now() - interval '9 days', now() + interval '30 days', v_security1),
    (v_condo, null, v_apartments[3], 'Fuga detectada en apartamento A201',
     'Se detecto una fuga de agua que afecta el apartamento inferior. Requiere atencion inmediata.',
     'MAINTENANCE', 'CRITICAL', 'ACTIVE', 'APARTMENT', now(), now() + interval '2 days', v_admin),
    (v_condo, null, null, 'Recordatorio de pago de administracion',
     'La fecha limite de pago de la cuota de administracion es el dia 10 de cada mes.',
     'PAYMENT', 'LOW', 'ACTIVE', 'CONDOMINIUM', now() - interval '15 days', now() + interval '60 days', v_admin),
    (v_condo, null, null, 'Mantenimiento de la red electrica finalizado',
     'Se completo el mantenimiento del tablero electrico principal.',
     'ELECTRICITY', 'LOW', 'RESOLVED', 'CONDOMINIUM', now() - interval '30 days', now() - interval '25 days', v_admin);

  -- --------------------------------------------------------------------------
  -- 14. Comunicados
  -- --------------------------------------------------------------------------
  insert into tribuia.announcements
    (condominium_id, title, content, audience, status, published_at, expires_at, created_by)
  values
    (v_condo, 'Asamblea General Ordinaria 2026',
     'Se convoca a todos los propietarios a la Asamblea General Ordinaria que se realizara el sabado 15 a las 9:00 a.m. en el salon social. Orden del dia: informe de gestion, presupuesto, eleccion del consejo de administracion y proposiciones.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '3 days', now() + interval '20 days', v_admin),
    (v_condo, 'Nuevo horario del salon social',
     'A partir del proximo mes el salon social estara disponible de lunes a domingo entre 8:00 a.m. y 10:00 p.m. Las reservas se realizan en la administracion con 48 horas de anticipacion.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '10 days', now() + interval '90 days', v_admin),
    (v_condo, 'Campana de reciclaje',
     'Iniciamos la campana de separacion de residuos. Se instalaron contenedores diferenciados en cada bloque. Agradecemos la colaboracion de todos los residentes.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '20 days', now() + interval '120 days', v_spokesperson),
    (v_condo, 'Resultados de la encuesta de zonas comunes',
     'El 78% de los residentes solicito priorizar la renovacion del parque infantil. El consejo evaluara el presupuesto en la proxima reunion.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '35 days', null, v_spokesperson),
    (v_condo, 'Borrador: reglamento de parqueaderos',
     'Documento en revision por el consejo de administracion.',
     'CONDOMINIUM', 'DRAFT', now(), null, v_admin);

  -- --------------------------------------------------------------------------
  -- 15. Solicitudes + comentarios
  -- --------------------------------------------------------------------------
  for i in 1..8 loop
    select profile_id into v_profile from tribuia.apartment_owners
      where apartment_id = v_apartments[i] and is_active limit 1;

    insert into tribuia.requests
      (condominium_id, building_id, apartment_id, title, description, type, priority, status,
       created_by, assigned_to, created_at)
    values (
      v_condo,
      (select building_id from tribuia.apartments where id = v_apartments[i]),
      v_apartments[i],
      (array['Goteo en el bano principal', 'Luz del pasillo fundida', 'Ruido excesivo en la noche',
             'Puerta del parqueadero no cierra', 'Solicitud de reserva del salon social',
             'Filtracion en el techo', 'Cambio de cerradura', 'Poda de arboles zona comun'])[i],
      (array['Se presenta un goteo constante en la ducha del bano principal desde hace tres dias.',
             'La luminaria del pasillo del piso 2 no enciende.',
             'Se reporta ruido excesivo despues de las 11:00 p.m. en el apartamento vecino.',
             'La puerta automatica del parqueadero no cierra completamente.',
             'Solicito reservar el salon social para el proximo sabado.',
             'Filtracion visible en el techo de la habitacion principal.',
             'Solicito autorizacion para cambiar la cerradura de la puerta principal.',
             'Los arboles de la zona comun requieren poda urgente.'])[i],
      (array['MAINTENANCE', 'MAINTENANCE', 'NOISE', 'SECURITY', 'COMMON_AREAS',
             'MAINTENANCE', 'ADMINISTRATION', 'COMMON_AREAS'])[i]::tribuia.request_type,
      (array['MEDIUM', 'LOW', 'HIGH', 'HIGH', 'LOW', 'CRITICAL', 'LOW', 'MEDIUM'])[i]::tribuia.priority_level,
      (array['OPEN', 'IN_PROGRESS', 'OPEN', 'IN_PROGRESS', 'RESOLVED',
             'OPEN', 'CLOSED', 'RESOLVED'])[i]::tribuia.request_status,
      coalesce(v_profile, v_admin),
      case when i % 2 = 0 then v_staff1 else v_staff2 end,
      now() - make_interval(days => i * 3)
    )
    returning id into v_request;

    insert into tribuia.request_comments (request_id, author_id, body, is_internal)
    values
      (v_request, v_admin, 'Solicitud recibida. Se asigno al personal de mantenimiento.', false),
      (v_request, case when i % 2 = 0 then v_staff1 else v_staff2 end,
       'Se programo la visita tecnica para revisar el caso.', false);
  end loop;

  -- --------------------------------------------------------------------------
  -- 16. Incidentes
  -- --------------------------------------------------------------------------
  for i in 1..6 loop
    insert into tribuia.incidents
      (condominium_id, building_id, apartment_id, type, title, description, location,
       occurred_at, priority, status, reported_by, assigned_to, resolution, resolved_at, created_at)
    values (
      v_condo,
      (select building_id from tribuia.apartments where id = v_apartments[i]),
      case when i % 2 = 0 then v_apartments[i] else null end,
      (array['THEFT', 'VANDALISM', 'TRESPASSING', 'NOISE', 'FLOOD', 'PARKING'])[i]::tribuia.incident_type,
      (array['Hurto de bicicleta en el bicicletero',
             'Grafiti en la pared del bloque B',
             'Persona no autorizada en la terraza',
             'Fiesta con ruido excesivo',
             'Inundacion en el sotano por lluvia',
             'Vehiculo mal parqueado bloqueando salida'])[i],
      (array['Se reporta el hurto de una bicicleta del bicicletero comun durante la madrugada.',
             'Se encontro un grafiti en la pared exterior del bloque B.',
             'Se detecto una persona sin autorizacion en la terraza del bloque C.',
             'Se recibieron multiples quejas por ruido excesivo pasadas las 2:00 a.m.',
             'La lluvia del fin de semana genero acumulacion de agua en el sotano.',
             'Un vehiculo visitante bloqueo la salida vehicular durante 40 minutos.'])[i],
      (array['Bicicletero comun', 'Fachada Bloque B', 'Terraza Bloque C',
             'Bloque A piso 3', 'Sotano de parqueaderos', 'Rampa de salida'])[i],
      now() - make_interval(days => i * 5),
      (array['HIGH', 'MEDIUM', 'CRITICAL', 'MEDIUM', 'HIGH', 'LOW'])[i]::tribuia.priority_level,
      (array['INVESTIGATING', 'RESOLVED', 'OPEN', 'RESOLVED', 'RESOLVED', 'CLOSED'])[i]::tribuia.incident_status,
      case when i % 2 = 0 then v_security1 else v_security2 end,
      v_admin,
      case when i in (2, 4, 5, 6) then 'Caso atendido y cerrado por la administracion.' else null end,
      case when i in (2, 4, 5, 6) then now() - make_interval(days => i * 2) else null end,
      now() - make_interval(days => i * 5)
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- 17. Multas
  -- --------------------------------------------------------------------------
  for i in 1..7 loop
    select id into v_resident from tribuia.residents
      where apartment_id = v_apartments[i] and is_active order by created_at limit 1;

    v_amount := 150000 + (i * 45000);

    insert into tribuia.fines
      (condominium_id, apartment_id, resident_id, reason, description, amount,
       fine_date, due_date, status, notes, created_by)
    values (
      v_condo, v_apartments[i], v_resident,
      (array['Ruido fuera del horario permitido',
             'Mascota sin correa en zonas comunes',
             'Uso indebido del parqueadero de visitantes',
             'Disposicion incorrecta de residuos',
             'Dano en zona comun',
             'Incumplimiento del reglamento de la piscina',
             'Retraso en el pago de la cuota de administracion'])[i],
      'Registro de infraccion al reglamento de propiedad horizontal.',
      v_amount,
      current_date - (i * 12),
      current_date + (30 - (i * 3)),
      (array['PENDING', 'PAID', 'PENDING', 'APPEALED', 'PAID', 'PENDING', 'CANCELLED'])[i]::tribuia.fine_status,
      'Notificado al residente por correo electronico.',
      v_admin
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- 18. Documentos
  -- --------------------------------------------------------------------------
  insert into tribuia.document_categories (condominium_id, name, description) values
    (v_condo, 'Legal',       'Reglamentos, actas y documentos legales'),
    (v_condo, 'Financiero',  'Presupuestos, estados financieros y facturas'),
    (v_condo, 'Manuales',    'Manuales tecnicos y de operacion');

  select id into v_doccat_legal   from tribuia.document_categories where condominium_id = v_condo and name = 'Legal';
  select id into v_doccat_finance from tribuia.document_categories where condominium_id = v_condo and name = 'Financiero';
  select id into v_doccat_manuals from tribuia.document_categories where condominium_id = v_condo and name = 'Manuales';

  insert into tribuia.documents
    (condominium_id, category_id, title, description, bucket, file_path, file_name,
     file_size, mime_type, visibility, is_restricted, uploaded_by)
  values
    (v_condo, v_doccat_legal, 'Reglamento de Propiedad Horizontal',
     'Reglamento vigente aprobado por la asamblea general.', 'documents',
     v_condo::text || '/documents/reglamento-propiedad-horizontal.pdf',
     'reglamento-propiedad-horizontal.pdf', 842000, 'application/pdf', 'CONDOMINIUM', false, v_admin),
    (v_condo, v_doccat_legal, 'Acta de Asamblea General 2025',
     'Acta de la asamblea general ordinaria del ano anterior.', 'documents',
     v_condo::text || '/documents/acta-asamblea-2025.pdf',
     'acta-asamblea-2025.pdf', 512000, 'application/pdf', 'CONDOMINIUM', false, v_admin),
    (v_condo, v_doccat_finance, 'Presupuesto anual aprobado',
     'Presupuesto de ingresos y gastos aprobado para la vigencia.', 'documents',
     v_condo::text || '/documents/presupuesto-anual.pdf',
     'presupuesto-anual.pdf', 388000, 'application/pdf', 'CONDOMINIUM', false, v_admin),
    (v_condo, v_doccat_finance, 'Estados financieros - uso interno',
     'Documento restringido al consejo y la administracion.', 'documents',
     v_condo::text || '/documents/estados-financieros.pdf',
     'estados-financieros.pdf', 640000, 'application/pdf', 'CONDOMINIUM', true, v_admin),
    (v_condo, v_doccat_manuals, 'Manual de convivencia',
     'Normas de convivencia y uso de zonas comunes.', 'documents',
     v_condo::text || '/documents/manual-convivencia.pdf',
     'manual-convivencia.pdf', 296000, 'application/pdf', 'CONDOMINIUM', false, v_spokesperson),
    (v_condo, v_doccat_manuals, 'Manual de operacion de ascensores',
     'Instructivo tecnico del fabricante.', 'documents',
     v_condo::text || '/documents/manual-ascensores.pdf',
     'manual-ascensores.pdf', 1240000, 'application/pdf', 'CONDOMINIUM', false, v_admin);

  -- --------------------------------------------------------------------------
  -- 19. Conversaciones y mensajes
  -- --------------------------------------------------------------------------
  k := 0;
  for i in 1..4 loop
    select profile_id into v_profile from tribuia.apartment_owners
      where apartment_id = v_apartments[i] and is_active limit 1;

    if v_profile is not null then
      k := k + 1;
      insert into tribuia.conversations (condominium_id, subject, type, created_by, last_message_at)
      values (v_condo,
              (array['Consulta sobre cuota de administracion',
                     'Reporte de dano en zona comun',
                     'Solicitud de certificado de paz y salvo',
                     'Autorizacion de ingreso de mudanza'])[i],
              'SUPPORT', v_profile, now() - make_interval(hours => i))
      returning id into v_conversation;

      insert into tribuia.conversation_participants (conversation_id, user_id, last_read_at)
      values (v_conversation, v_profile, now()),
             (v_conversation, v_admin, case when i = 1 then now() else null end);

      insert into tribuia.messages (conversation_id, condominium_id, sender_id, body, created_at)
      values
        (v_conversation, v_condo, v_profile,
         (array['Buen dia, quisiera confirmar el valor de la cuota de administracion de este mes.',
                'Buenas tardes, reporto un dano en la baranda del pasillo del segundo piso.',
                'Hola, necesito el certificado de paz y salvo para un tramite bancario.',
                'Buenas, solicito autorizacion para una mudanza el proximo sabado.'])[i],
         now() - make_interval(hours => i, mins => 30)),
        (v_conversation, v_condo, v_admin,
         (array['Buen dia. El valor vigente es de $320.000 y vence el dia 10.',
                'Gracias por el reporte. Ya generamos la solicitud de mantenimiento correspondiente.',
                'Con gusto. El certificado estara listo en 2 dias habiles.',
                'Autorizado. Por favor coordine el horario con la porteria.'])[i],
         now() - make_interval(hours => i));
    end if;
  end loop;

  raise notice 'Seed completado. Condominio: % | Bloques: 3 | Apartamentos: 15 | Conversaciones: %',
    v_condo, k;
end
$$;

-- ============================================================================
-- Resumen de lo creado
-- ============================================================================
select 'condominiums' as tabla, count(*) from tribuia.condominiums
union all select 'condominium_members', count(*) from tribuia.condominium_members
union all select 'buildings', count(*) from tribuia.buildings
union all select 'apartments', count(*) from tribuia.apartments
union all select 'apartment_owners', count(*) from tribuia.apartment_owners
union all select 'apartment_tenants', count(*) from tribuia.apartment_tenants
union all select 'residents', count(*) from tribuia.residents
union all select 'vehicles', count(*) from tribuia.vehicles
union all select 'pets', count(*) from tribuia.pets
union all select 'alerts', count(*) from tribuia.alerts
union all select 'announcements', count(*) from tribuia.announcements
union all select 'notifications', count(*) from tribuia.notifications
union all select 'conversations', count(*) from tribuia.conversations
union all select 'messages', count(*) from tribuia.messages
union all select 'requests', count(*) from tribuia.requests
union all select 'request_comments', count(*) from tribuia.request_comments
union all select 'incidents', count(*) from tribuia.incidents
union all select 'expense_categories', count(*) from tribuia.expense_categories
union all select 'expenses', count(*) from tribuia.expenses
union all select 'purchases', count(*) from tribuia.purchases
union all select 'purchase_items', count(*) from tribuia.purchase_items
union all select 'fines', count(*) from tribuia.fines
union all select 'documents', count(*) from tribuia.documents
union all select 'audit_logs', count(*) from tribuia.audit_logs
order by 1;
