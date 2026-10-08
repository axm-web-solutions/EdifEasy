-- ============================================================================
-- EdiFeasy :: Segundo condominio de prueba - Conjunto Residencial Horeb
--             (Armenia, Quindio)
-- ----------------------------------------------------------------------------
-- Se ejecuta COMPLETO en el SQL Editor de Supabase. No necesita `npm run seed`
-- para sus propios usuarios: los crea aqui mismo en auth.users.
--
-- REQUISITO: que ya exista admin@edifeasy.com (seed principal). Ese mismo
-- usuario queda como administrador de Horeb, asi que al iniciar sesion puede
-- cambiar entre "Altos del Parque" (Bogota) y "Horeb" (Armenia).
--
-- Password de los usuarios nuevos: EdiFeasy2024*
--
-- Es idempotente: reutiliza los usuarios si ya existen y borra/recrea el
-- condominio (por NIT) en cada ejecucion. No toca el conjunto de Bogota.
-- ============================================================================

do $$
declare
  c_password     constant text := 'EdiFeasy2024*';
  c_nit          constant text := '901765432-1';

  v_condo        uuid;
  v_admin        uuid;
  v_spokes       uuid;
  v_security1    uuid;
  v_security2    uuid;
  v_staff        uuid;
  v_owners       uuid[] := '{}';
  v_tenants      uuid[] := '{}';

  v_role_admin    uuid;
  v_role_spokes   uuid;
  v_role_owner    uuid;
  v_role_tenant   uuid;
  v_role_security uuid;
  v_role_staff    uuid;

  v_buildings    uuid[] := '{}';
  v_apartments   uuid[] := '{}';
  v_occupied     int[]  := array[1, 2, 3, 4, 5, 6, 9, 10, 11, 13];
  v_building     uuid;
  v_apartment    uuid;
  v_user         uuid;
  v_request      uuid;
  v_purchase     uuid;
  v_conversation uuid;
  v_resident     uuid;
  v_doccat_legal uuid;
  v_doccat_conv  uuid;
  v_month_start  date;

  -- email, nombre, telefono, documento, rol
  v_users text[][] := array[
    array['vocero.horeb@edifeasy.com',        'Gloria Ocampo',     '+57 316 700 0001', '94300001', 'SPOKESPERSON'],
    array['portero1.horeb@edifeasy.com',      'Hernan Zuluaga',    '+57 316 700 0002', '94300002', 'SECURITY'],
    array['portero2.horeb@edifeasy.com',      'Luz Dary Cardona',  '+57 316 700 0003', '94300003', 'SECURITY'],
    array['servicios.horeb@edifeasy.com',     'Fabio Montoya',     '+57 316 700 0004', '94300004', 'SERVICE_STAFF'],
    array['propietario1.horeb@edifeasy.com',  'Juliana Velez',     '+57 316 700 0005', '94300005', 'OWNER'],
    array['propietario2.horeb@edifeasy.com',  'Ricardo Botero',    '+57 316 700 0006', '94300006', 'OWNER'],
    array['propietario3.horeb@edifeasy.com',  'Natalia Quintero',  '+57 316 700 0007', '94300007', 'OWNER'],
    array['propietario4.horeb@edifeasy.com',  'Alejandro Patino',  '+57 316 700 0008', '94300008', 'OWNER'],
    array['arrendatario1.horeb@edifeasy.com', 'Camila Restrepo',   '+57 316 700 0009', '94300009', 'TENANT'],
    array['arrendatario2.horeb@edifeasy.com', 'Sebastian Arias',   '+57 316 700 0010', '94300010', 'TENANT']
  ];
  i int;
  j int;
  m int;
begin
  -- --------------------------------------------------------------------------
  -- 0. Validaciones
  -- --------------------------------------------------------------------------
  select id into v_role_admin    from tribuia.roles where code = 'ADMINISTRATOR';
  select id into v_role_spokes   from tribuia.roles where code = 'SPOKESPERSON';
  select id into v_role_owner    from tribuia.roles where code = 'OWNER';
  select id into v_role_tenant   from tribuia.roles where code = 'TENANT';
  select id into v_role_security from tribuia.roles where code = 'SECURITY';
  select id into v_role_staff    from tribuia.roles where code = 'SERVICE_STAFF';
  if v_role_admin is null then
    raise exception 'No existe el catalogo de roles. Ejecuta primero supabase/schema.sql';
  end if;

  select id into v_admin from tribuia.profiles where lower(email) = 'admin@edifeasy.com';
  if v_admin is null then
    raise exception 'No existe admin@edifeasy.com. Ejecuta primero el seed principal (npm run seed + seed.sql)';
  end if;

  -- --------------------------------------------------------------------------
  -- 1. Usuarios en Supabase Auth (el trigger handle_new_user crea el perfil)
  -- --------------------------------------------------------------------------
  for i in 1..array_length(v_users, 1) loop
    select id into v_user from auth.users where lower(email) = v_users[i][1];

    if v_user is null then
      v_user := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
        v_users[i][1], extensions.crypt(c_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'full_name', v_users[i][2], 'phone', v_users[i][3],
          'document_number', v_users[i][4], 'document_type', 'CC', 'seed_role', v_users[i][5]
        ),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user, v_user::text,
        jsonb_build_object('sub', v_user::text, 'email', v_users[i][1], 'email_verified', true),
        'email', now(), now(), now()
      );
    else
      update auth.users
         set encrypted_password = extensions.crypt(c_password, extensions.gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = v_user;
    end if;

    -- Perfil sincronizado (por si el trigger no existia)
    insert into tribuia.profiles (id, email, full_name, phone, document_number, document_type, status)
    values (v_user, v_users[i][1], v_users[i][2], v_users[i][3], v_users[i][4], 'CC', 'ACTIVE')
    on conflict (id) do update
      set full_name = excluded.full_name, phone = excluded.phone,
          document_number = excluded.document_number, status = 'ACTIVE';

    case v_users[i][5]
      when 'SPOKESPERSON'  then v_spokes := v_user;
      when 'SECURITY'      then
        if v_security1 is null then v_security1 := v_user; else v_security2 := v_user; end if;
      when 'SERVICE_STAFF' then v_staff := v_user;
      when 'OWNER'         then v_owners := array_append(v_owners, v_user);
      when 'TENANT'        then v_tenants := array_append(v_tenants, v_user);
    end case;
  end loop;

  -- --------------------------------------------------------------------------
  -- 2. Limpieza del condominio (idempotencia)
  -- --------------------------------------------------------------------------
  delete from tribuia.condominiums where nit = c_nit;

  -- --------------------------------------------------------------------------
  -- 3. Condominio
  -- La direccion es solo "Horeb" a proposito: asi el mapa del dashboard lo
  -- ubica exacto (con "Avenida Centenario" el punto cae a ~3 km).
  -- --------------------------------------------------------------------------
  insert into tribuia.condominiums
    (name, nit, address, city, country, phone, email, description, status, settings, created_by)
  values
    ('Conjunto Residencial Horeb', c_nit, 'Horeb', 'Armenia', 'Colombia',
     '+57 606 745 0200', 'administracion@conjuntohoreb.com',
     'Conjunto residencial en el norte de Armenia, Quindio (Comuna Quimbaya, sobre la Avenida Centenario). '
       || '2 torres de 8 apartamentos con piscina, BBQ, parque infantil y porteria 24 horas.',
     'ACTIVE', jsonb_build_object('primaryColor', '#0f766e'), v_admin)
  returning id into v_condo;

  -- --------------------------------------------------------------------------
  -- 4. Membresias (mismo administrador que el conjunto de Bogota)
  -- --------------------------------------------------------------------------
  insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position) values
    (v_condo, v_admin,     v_role_admin,    'ACTIVE', 'Administrador'),
    (v_condo, v_spokes,    v_role_spokes,   'ACTIVE', 'Presidente del Consejo'),
    (v_condo, v_security1, v_role_security, 'ACTIVE', 'Portero turno dia'),
    (v_condo, v_security2, v_role_security, 'ACTIVE', 'Portero turno noche'),
    (v_condo, v_staff,     v_role_staff,    'ACTIVE', 'Todero y jardineria');

  for i in 1..array_length(v_owners, 1) loop
    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
    values (v_condo, v_owners[i], v_role_owner, 'ACTIVE');
  end loop;
  for i in 1..array_length(v_tenants, 1) loop
    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status)
    values (v_condo, v_tenants[i], v_role_tenant, 'ACTIVE');
  end loop;

  -- --------------------------------------------------------------------------
  -- 5. Torres (2) y apartamentos (16): 1101, 1102 ... 2401, 2402
  -- --------------------------------------------------------------------------
  for i in 1..2 loop
    insert into tribuia.buildings (condominium_id, name, number, description, floors, status)
    values (v_condo,
            (array['Torre Guadua', 'Torre Cafetal'])[i], i::text,
            (array['Torre de 4 pisos con vista a la cordillera.',
                   'Torre de 4 pisos junto a la zona de piscina.'])[i],
            4, 'ACTIVE')
    returning id into v_building;
    v_buildings := array_append(v_buildings, v_building);

    for j in 1..8 loop
      insert into tribuia.apartments
        (condominium_id, building_id, number, floor, area, bedrooms, bathrooms,
         parking_spots, coefficient, status, description)
      values (
        v_condo, v_building,
        i::text || ((j + 1) / 2)::text || '0' || (2 - j % 2)::text,
        (j + 1) / 2,
        case when j % 2 = 1 then 78 else 96 end,
        case when j % 2 = 1 then 2 else 3 end,
        2, 1, round((100.0 / 16)::numeric, 5), 'VACANT',
        'Apartamento ' || i::text || ((j + 1) / 2)::text || '0' || (2 - j % 2)::text
          || ' de la ' || (array['Torre Guadua', 'Torre Cafetal'])[i]
      )
      returning id into v_apartment;
      v_apartments := array_append(v_apartments, v_apartment);
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 6. Propietarios (aptos 1..4) y arrendatarios (aptos 9..10)
  -- --------------------------------------------------------------------------
  for i in 1..array_length(v_owners, 1) loop
    insert into tribuia.apartment_owners
      (apartment_id, profile_id, ownership_percentage, is_primary, start_date, is_active)
    values (v_apartments[i], v_owners[i], 100, true, current_date - (i * 120), true);

    insert into tribuia.residents
      (condominium_id, apartment_id, profile_id, full_name, document_number, relationship, phone, email, is_active)
    select v_condo, v_apartments[i], p.id, p.full_name, p.document_number, 'OWNER', p.phone, p.email, true
    from tribuia.profiles p where p.id = v_owners[i];
  end loop;

  for i in 1..array_length(v_tenants, 1) loop
    insert into tribuia.apartment_tenants
      (apartment_id, profile_id, lease_start, lease_end, monthly_rent, is_active)
    values (v_apartments[8 + i], v_tenants[i], current_date - 90, current_date + 275,
            1400000 + ((i - 1) * 150000), true);

    insert into tribuia.residents
      (condominium_id, apartment_id, profile_id, full_name, document_number, relationship, phone, email, is_active)
    select v_condo, v_apartments[8 + i], p.id, p.full_name, p.document_number, 'TENANT', p.phone, p.email, true
    from tribuia.profiles p where p.id = v_tenants[i];
  end loop;

  -- Ocupacion: 10 ocupados, 1 en mantenimiento, 5 libres (autoregistro)
  update tribuia.apartments set status = 'OCCUPIED'
   where id = any (select v_apartments[k] from unnest(v_occupied) as k);
  update tribuia.apartments set status = 'MAINTENANCE' where id = v_apartments[15];

  -- --------------------------------------------------------------------------
  -- 7. Familiares, vehiculos y mascotas
  -- --------------------------------------------------------------------------
  for i in 1..5 loop
    insert into tribuia.residents
      (condominium_id, apartment_id, full_name, document_number, relationship, birth_date, phone, is_active)
    values (v_condo, v_apartments[v_occupied[i]],
            (array['Valentina Ospina', 'Samuel Giraldo', 'Isabella Arango', 'Mateo Henao', 'Mariana Londono'])[i],
            '11' || (500000 + i)::text, 'FAMILY',
            make_date(1997 + i, i * 2, 10),
            '+57 315 600 ' || lpad((1000 + i)::text, 4, '0'), true);
  end loop;

  for i in 1..array_length(v_occupied, 1) loop
    insert into tribuia.vehicles
      (condominium_id, apartment_id, type, brand, model, color, plate, parking_spot, is_active)
    values (
      v_condo, v_apartments[v_occupied[i]],
      case when i % 5 = 0 then 'MOTORCYCLE'::tribuia.vehicle_type else 'CAR'::tribuia.vehicle_type end,
      (array['Kia', 'Suzuki', 'Volkswagen', 'Hyundai', 'Yamaha'])[1 + (i - 1) % 5],
      (array['Picanto', 'Swift', 'T-Cross', 'Tucson', 'NMAX'])[1 + (i - 1) % 5],
      (array['Rojo', 'Blanco', 'Gris', 'Negro', 'Azul'])[1 + (i - 1) % 5],
      'QND' || (99 + i)::text,
      'H-' || lpad(i::text, 2, '0'),
      true
    );
  end loop;

  insert into tribuia.pets (condominium_id, apartment_id, name, type, breed, color, weight, vaccinated) values
    (v_condo, v_apartments[1],  'Canela', 'DOG', 'Golden Retriever', 'Dorado',         28,  true),
    (v_condo, v_apartments[3],  'Mishi',  'CAT', 'Criollo',          'Atigrado',       4.2, true),
    (v_condo, v_apartments[10], 'Tinto',  'DOG', 'Schnauzer',        'Sal y pimienta', 9,   false);

  -- --------------------------------------------------------------------------
  -- 8. Categorias de gasto + gastos (6 meses)
  -- --------------------------------------------------------------------------
  insert into tribuia.expense_categories (condominium_id, name, code, color, description) values
    (v_condo, 'Administracion',     'ADM', '#0f766e', 'Honorarios y gastos administrativos'),
    (v_condo, 'Mantenimiento',      'MTO', '#f59e0b', 'Mantenimiento preventivo y correctivo'),
    (v_condo, 'Servicios publicos', 'SPU', '#10b981', 'EPA, EDEQ y gas'),
    (v_condo, 'Seguridad',          'SEG', '#ef4444', 'Porteria y control de acceso'),
    (v_condo, 'Piscina',            'PIS', '#0ea5e9', 'Quimicos y mantenimiento de la piscina');

  for m in 0..5 loop
    v_month_start := (date_trunc('month', current_date) - make_interval(months => m))::date;

    insert into tribuia.expenses
      (condominium_id, category_id, concept, provider, amount, expense_date, invoice_number, description, status, created_by)
    select v_condo, c.id, x.concept, x.provider, x.amount, v_month_start + x.day_offset,
           'HRB-' || c.code || '-' || to_char(v_month_start, 'YYYYMM'), x.description,
           x.status::tribuia.expense_status, v_admin
    from (values
      ('Administracion',     'Honorarios administracion',          'Administraciones del Quindio SAS', 2400000 + m * 30000, 4,  'Honorarios mensuales de administracion',      'PAID'),
      ('Servicios publicos', 'Acueducto y energia zonas comunes',  'EPA / EDEQ',                       1100000 + m * 52000, 8,  'Consumo de agua y energia en zonas comunes',  'PAID'),
      ('Seguridad',          'Porteria 24 horas',                  'Vigilancia Cafetera Ltda',         4200000 + m * 25000, 10, 'Servicio de porteria con un puesto 24/7',     'PAID'),
      ('Piscina',            'Quimicos y mantenimiento piscina',   'Aguas Claras Armenia',              650000 + m * 18000, 13, 'Cloro, pH y limpieza semanal',                'PAID')
    ) as x(category, concept, provider, amount, day_offset, description, status)
    join tribuia.expense_categories c on c.condominium_id = v_condo and c.name = x.category;

    if m % 2 = 1 or m = 0 then
      insert into tribuia.expenses
        (condominium_id, category_id, concept, provider, amount, expense_date, invoice_number, description, status, created_by)
      select v_condo, c.id, 'Poda y jardineria', 'Jardines del Eje', 780000 + m * 40000,
             v_month_start + 17, 'HRB-MTO-' || to_char(v_month_start, 'YYYYMM'),
             'Poda de guaduas y mantenimiento de jardines',
             case when m = 0 then 'PENDING'::tribuia.expense_status else 'PAID'::tribuia.expense_status end,
             v_admin
      from tribuia.expense_categories c where c.condominium_id = v_condo and c.name = 'Mantenimiento';
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 9. Compras + items
  -- --------------------------------------------------------------------------
  for i in 1..3 loop
    insert into tribuia.purchases
      (condominium_id, provider, purchase_date, status, invoice_number, notes, created_by)
    values (v_condo,
            (array['Ferreteria La Cejita', 'Viveros El Eden', 'Electricos Armenia'])[i],
            current_date - (i * 15),
            (array['RECEIVED', 'ORDERED', 'DRAFT'])[i]::tribuia.purchase_status,
            'HRB-CP-' || lpad(i::text, 4, '0'),
            'Compra para zonas comunes del conjunto.', v_admin)
    returning id into v_purchase;

    for j in 1..2 loop
      insert into tribuia.purchase_items (purchase_id, product, description, quantity, unit_price)
      values (v_purchase,
              (array['Cloro granulado 10kg', 'Kit medidor de pH',
                     'Plantas ornamentales', 'Abono organico 25kg',
                     'Reflector LED 50W', 'Fotocelda'])[(i - 1) * 2 + j],
              'Insumo para zonas comunes',
              (array[2, 1, 20, 4, 6, 6])[(i - 1) * 2 + j],
              (array[185000, 95000, 18000, 42000, 68000, 22000])[(i - 1) * 2 + j]);
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 10. Alertas y comunicados
  -- --------------------------------------------------------------------------
  insert into tribuia.alerts
    (condominium_id, building_id, apartment_id, title, description, type, priority, status,
     audience, start_at, end_at, created_by)
  values
    (v_condo, null, null, 'Mantenimiento de la piscina',
     'La piscina estara cerrada el lunes y martes por lavado y cambio de arena del filtro.',
     'MAINTENANCE', 'MEDIUM', 'ACTIVE', 'CONDOMINIUM', now() - interval '1 day', now() + interval '4 days', v_admin),
    (v_condo, null, null, 'Suspension de agua - EPA',
     'Empresas Publicas de Armenia anuncia suspension del servicio el jueves de 9:00 a.m. a 4:00 p.m. por obras en la Avenida Centenario.',
     'WATER', 'HIGH', 'ACTIVE', 'CONDOMINIUM', now(), now() + interval '3 days', v_admin),
    (v_condo, v_buildings[2], null, 'Ascensor Torre Cafetal fuera de servicio',
     'El ascensor de la Torre Cafetal esta en revision tecnica. Use las escaleras mientras tanto.',
     'MAINTENANCE', 'HIGH', 'ACTIVE', 'BUILDING', now(), now() + interval '2 days', v_staff),
    (v_condo, null, null, 'Control de visitantes',
     'Todo visitante debe anunciarse en porteria y presentar documento.',
     'SECURITY', 'LOW', 'ACTIVE', 'CONDOMINIUM', now() - interval '7 days', now() + interval '30 days', v_security1);

  insert into tribuia.announcements
    (condominium_id, title, content, audience, status, published_at, expires_at, created_by)
  values
    (v_condo, 'Asamblea ordinaria Horeb 2026',
     'Se convoca a los propietarios a la asamblea ordinaria el sabado a las 10:00 a.m. en el kiosko BBQ. Orden del dia: informe de gestion, presupuesto y proyecto de cubierta para la piscina.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '2 days', now() + interval '25 days', v_admin),
    (v_condo, 'Horario de la piscina',
     'La piscina funciona de martes a domingo de 8:00 a.m. a 7:00 p.m. Los menores de 12 anos deben estar acompanados por un adulto.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '12 days', now() + interval '120 days', v_spokes),
    (v_condo, 'Jornada de siembra de guaduas',
     'Invitamos a las familias a la jornada de siembra del domingo en el lindero norte del conjunto.',
     'CONDOMINIUM', 'PUBLISHED', now() - interval '25 days', null, v_spokes);

  -- --------------------------------------------------------------------------
  -- 11. Solicitudes + comentarios
  -- --------------------------------------------------------------------------
  for i in 1..5 loop
    insert into tribuia.requests
      (condominium_id, building_id, apartment_id, title, description, type, priority, status,
       created_by, assigned_to, created_at)
    values (
      v_condo,
      (select building_id from tribuia.apartments where id = v_apartments[v_occupied[i]]),
      v_apartments[v_occupied[i]],
      (array['Humedad en la pared del cuarto', 'Reserva del kiosko BBQ', 'Perro ladrando en la noche',
             'Citofono sin tono', 'Certificado de residencia'])[i],
      (array['Aparecio humedad en la pared que colinda con el ducto.',
             'Solicito el kiosko BBQ para el sabado en la tarde.',
             'El perro del apartamento vecino ladra despues de las 10 p.m.',
             'El citofono del apartamento no recibe llamadas de porteria.',
             'Necesito un certificado de residencia para tramite en la alcaldia.'])[i],
      (array['MAINTENANCE', 'COMMON_AREAS', 'NOISE', 'SECURITY', 'ADMINISTRATION'])[i]::tribuia.request_type,
      (array['MEDIUM', 'LOW', 'MEDIUM', 'HIGH', 'LOW'])[i]::tribuia.priority_level,
      (array['OPEN', 'RESOLVED', 'IN_PROGRESS', 'OPEN', 'CLOSED'])[i]::tribuia.request_status,
      coalesce(v_owners[i], v_admin),
      v_staff,
      now() - make_interval(days => i * 4)
    )
    returning id into v_request;

    insert into tribuia.request_comments (request_id, author_id, body, is_internal) values
      (v_request, v_admin, 'Recibido. Lo asignamos al personal de mantenimiento.', false),
      (v_request, v_staff, 'Paso a revisar en el transcurso de la semana.', false);
  end loop;

  -- --------------------------------------------------------------------------
  -- 12. Incidentes
  -- --------------------------------------------------------------------------
  for i in 1..4 loop
    insert into tribuia.incidents
      (condominium_id, building_id, apartment_id, type, title, description, location,
       occurred_at, priority, status, reported_by, assigned_to, resolution, resolved_at, created_at)
    values (
      v_condo, v_buildings[1 + (i - 1) % 2], null,
      (array['THEFT', 'TRESPASSING', 'NOISE', 'FLOOD'])[i]::tribuia.incident_type,
      (array['Hurto de casco en parqueadero de motos', 'Ingreso no autorizado por el lindero',
             'Musica alta en la zona BBQ', 'Encharcamiento por aguacero'])[i],
      (array['Un residente reporta el hurto de un casco dejado sobre la moto.',
             'Se vio a una persona saltando la malla del lindero norte.',
             'Reunion con musica alta despues de la hora permitida.',
             'El aguacero de la tarde inundo la entrada vehicular.'])[i],
      (array['Parqueadero de motos', 'Lindero norte', 'Kiosko BBQ', 'Entrada vehicular'])[i],
      now() - make_interval(days => i * 6),
      (array['HIGH', 'CRITICAL', 'LOW', 'MEDIUM'])[i]::tribuia.priority_level,
      (array['INVESTIGATING', 'OPEN', 'RESOLVED', 'CLOSED'])[i]::tribuia.incident_status,
      case when i % 2 = 1 then v_security1 else v_security2 end,
      v_admin,
      case when i >= 3 then 'Caso atendido por la administracion.' else null end,
      case when i >= 3 then now() - make_interval(days => i * 2) else null end,
      now() - make_interval(days => i * 6)
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- 13. Multas
  -- --------------------------------------------------------------------------
  for i in 1..4 loop
    select id into v_resident from tribuia.residents
     where apartment_id = v_apartments[v_occupied[i]] and relationship <> 'FAMILY'
     order by created_at limit 1;

    insert into tribuia.fines
      (condominium_id, apartment_id, resident_id, reason, description, amount,
       fine_date, due_date, status, notes, created_by)
    values (
      v_condo, v_apartments[v_occupied[i]], v_resident,
      (array['Mascota sin correa en zonas comunes', 'Uso de la piscina fuera del horario',
             'Parqueo en zona de visitantes', 'Ruido despues de las 10 p.m.'])[i],
      'Infraccion al manual de convivencia del conjunto.',
      (array[180000, 120000, 150000, 220000])[i],
      current_date - (i * 10),
      current_date + (20 - i * 4),
      (array['PENDING', 'PAID', 'PENDING', 'APPEALED'])[i]::tribuia.fine_status,
      'Notificado por correo y en porteria.',
      v_admin
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- 14. Documentos
  -- --------------------------------------------------------------------------
  insert into tribuia.document_categories (condominium_id, name, description)
  values (v_condo, 'Legal', 'Reglamento y actas')
  returning id into v_doccat_legal;
  insert into tribuia.document_categories (condominium_id, name, description)
  values (v_condo, 'Convivencia', 'Manuales y normas de uso')
  returning id into v_doccat_conv;

  insert into tribuia.documents
    (condominium_id, category_id, title, description, bucket, file_path, file_name,
     file_size, mime_type, visibility, is_restricted, uploaded_by)
  values
    (v_condo, v_doccat_legal, 'Reglamento de Propiedad Horizontal Horeb', 'Reglamento vigente del conjunto.',
     'documents', v_condo::text || '/documents/reglamento-horeb.pdf', 'reglamento-horeb.pdf',
     720000, 'application/pdf', 'CONDOMINIUM', false, v_admin),
    (v_condo, v_doccat_legal, 'Acta de consejo - uso interno', 'Restringido al consejo y la administracion.',
     'documents', v_condo::text || '/documents/acta-consejo.pdf', 'acta-consejo.pdf',
     310000, 'application/pdf', 'CONDOMINIUM', true, v_admin),
    (v_condo, v_doccat_conv, 'Reglamento de uso de la piscina', 'Horarios, aforo y normas de seguridad.',
     'documents', v_condo::text || '/documents/reglamento-piscina.pdf', 'reglamento-piscina.pdf',
     180000, 'application/pdf', 'CONDOMINIUM', false, v_admin);

  -- --------------------------------------------------------------------------
  -- 15. Conversaciones y mensajes
  -- --------------------------------------------------------------------------
  for i in 1..2 loop
    insert into tribuia.conversations (condominium_id, subject, type, created_by, last_message_at)
    values (v_condo,
            (array['Cuota extraordinaria de la cubierta', 'Trasteo el fin de semana'])[i],
            'SUPPORT', v_owners[i], now() - make_interval(days => i - 1))
    returning id into v_conversation;

    insert into tribuia.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_conversation, v_owners[i], now()),
           (v_conversation, v_admin, null);

    insert into tribuia.messages (conversation_id, condominium_id, sender_id, body, created_at)
    values
      (v_conversation, v_condo, v_owners[i],
       (array['Buenas, ¿de cuanto seria la cuota extraordinaria para la cubierta de la piscina?',
              'Buen dia, ¿puedo hacer trasteo el sabado en la manana?'])[i],
       now() - make_interval(days => i - 1, hours => 2)),
      (v_conversation, v_condo, v_admin,
       (array['Hola. Se presentara en la asamblea; el estimado es de $450.000 por apartamento.',
              'Claro, de 8:00 a.m. a 12:00 m. Coordine con porteria.'])[i],
       now() - make_interval(days => i - 1));
  end loop;

  raise notice 'Horeb creado: % | Admin compartido: admin@edifeasy.com | Password usuarios nuevos: %',
    v_condo, c_password;
end
$$;

-- Verificacion rapida
select c.name, c.city,
       (select count(*) from tribuia.buildings b where b.condominium_id = c.id)          as torres,
       (select count(*) from tribuia.apartments a where a.condominium_id = c.id)         as apartamentos,
       (select count(*) from tribuia.condominium_members m where m.condominium_id = c.id) as miembros,
       (select string_agg(r.code, ', ')
          from tribuia.condominium_members m
          join tribuia.roles r on r.id = m.role_id
          join tribuia.profiles p on p.id = m.user_id
         where m.user_id = p.id and lower(p.email) = 'admin@edifeasy.com' and m.condominium_id = c.id) as rol_admin_edifeasy
from tribuia.condominiums c
order by c.name;
