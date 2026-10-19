-- ============================================================================
-- EdiFeasy :: Alta del CONDOMINIO CAMPESTRE ANGELES DEL BOSQUE (cliente real)
-- ----------------------------------------------------------------------------
-- Datos tomados del RUT (DIAN, formulario 141256184871, actualizado 2026-06-09):
--   NIT 900518186-0 · Km 7 Via Circasia - Armenia · Circasia (Quindio)
--   angelesdelbosque.quindio@gmail.com · 310 434 4995
--
-- Estructura: 35 casas y un salon social (zona comun, no se cobra ni cuenta
-- para el plan). Las casas quedan LIBRES para que cada propietario real se
-- inscriba desde la app; mientras tanto se crean residentes de referencia
-- "Propietario Casa NN" sin cuenta de acceso.
--
-- Administrador: cuenta DE PRUEBA hasta tener los datos del real. La cuota de
-- administracion la define el administrador desde la app.
--
-- SEGURIDAD
--   * Antes de ejecutar, cambia c_admin_password por una clave segura.
--   * Es solo-insercion: si el condominio ya existe (mismo NIT) no hace nada,
--     para no tocar datos reales al re-ejecutarlo por error.
--
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

do $$
declare
  -- >>> CAMBIA ESTA CLAVE ANTES DE EJECUTAR (minimo 10 caracteres) <<<
  c_admin_password constant text := 'CAMBIAR_ESTA_CLAVE';

  c_nit           constant text := '900518186-0';
  c_admin_email   constant text := 'admin.angelesdelbosque@edifeasy.com';
  c_admin_name    constant text := 'Administrador de Prueba Angeles del Bosque';
  c_houses        constant int  := 35;

  v_condo     uuid;
  v_building  uuid;
  v_apartment uuid;
  v_admin     uuid;
  v_creator   uuid;
  v_role_admin uuid;
  i int;
begin
  if c_admin_password = 'CAMBIAR_ESTA_CLAVE' or length(c_admin_password) < 10 then
    raise exception 'Define una clave segura en c_admin_password (minimo 10 caracteres) antes de ejecutar.';
  end if;

  if exists (select 1 from tribuia.condominiums where nit = c_nit) then
    raise notice 'El condominio con NIT % ya existe. No se hizo ningun cambio.', c_nit;
    return;
  end if;

  select id into v_role_admin from tribuia.roles where code = 'ADMINISTRATOR';
  if v_role_admin is null then
    raise exception 'No existe el catalogo de roles. Ejecuta primero supabase/schema.sql';
  end if;

  -- Quien queda como creador: el super administrador de la plataforma, si existe.
  select ur.user_id into v_creator
    from tribuia.user_roles ur
    join tribuia.roles r on r.id = ur.role_id and r.code = 'SUPER_ADMIN'
   limit 1;

  -- --------------------------------------------------------------------------
  -- 1. Condominio (con la ubicacion de OpenStreetMap ya guardada)
  -- --------------------------------------------------------------------------
  insert into tribuia.condominiums
    (name, nit, address, city, country, phone, email, description, status, settings, created_by,
     latitude, longitude, location_label, location_approximate, location_source)
  values
    ('Condominio Campestre Angeles del Bosque', c_nit,
     'Km 7 Via Circasia - Armenia', 'Circasia', 'Colombia',
     '+57 310 434 4995', 'angelesdelbosque.quindio@gmail.com',
     'Condominio campestre de 35 casas con salon social, en el kilometro 7 de la via Circasia - Armenia (Quindio).',
     'ACTIVE', jsonb_build_object('primaryColor', '#2f6b3f'), v_creator,
     4.634531, -75.615561, 'Condominio Angeles del Bosque, Circasia, Quindio', false,
     -- Debe coincidir con locationSourceKey() del frontend: "direccion, ciudad, pais".
     'Km 7 Via Circasia - Armenia, Circasia, Colombia')
  returning id into v_condo;

  -- --------------------------------------------------------------------------
  -- 2. Casas: un bloque con 35 unidades (01 a 35)
  -- --------------------------------------------------------------------------
  insert into tribuia.buildings (condominium_id, name, number, description, floors, status)
  values (v_condo, 'Casas', 'C', '35 casas campestres. El salon social es zona comun.', 1, 'ACTIVE')
  returning id into v_building;

  for i in 1..c_houses loop
    insert into tribuia.apartments
      (condominium_id, building_id, number, floor, coefficient, status, description)
    values (v_condo, v_building, lpad(i::text, 2, '0'), 1,
            round((100.0 / c_houses)::numeric, 5), 'OCCUPIED',
            'Casa ' || lpad(i::text, 2, '0'))
    returning id into v_apartment;

    -- Residente de referencia (sin cuenta): no ocupa la casa para la inscripcion.
    insert into tribuia.residents
      (condominium_id, apartment_id, full_name, relationship, is_active)
    values (v_condo, v_apartment, 'Propietario Casa ' || lpad(i::text, 2, '0'), 'OWNER', true);
  end loop;

  -- --------------------------------------------------------------------------
  -- 3. Administrador de prueba (Supabase Auth + membresia)
  -- --------------------------------------------------------------------------
  select id into v_admin from auth.users where lower(email) = c_admin_email;

  if v_admin is null then
    v_admin := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
      c_admin_email, extensions.crypt(c_admin_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', c_admin_name, 'document_type', 'CC'),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_admin, v_admin::text,
      jsonb_build_object('sub', v_admin::text, 'email', c_admin_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into tribuia.profiles (id, email, full_name, document_type, status)
  values (v_admin, c_admin_email, c_admin_name, 'CC', 'ACTIVE')
  on conflict (id) do nothing;

  insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position)
  values (v_condo, v_admin, v_role_admin, 'ACTIVE', 'Administrador (cuenta de prueba)')
  on conflict do nothing;

  raise notice 'Creado: % | % casas | administrador de prueba: %', v_condo, c_houses, c_admin_email;
end
$$;

-- Verificacion -----------------------------------------------------------------
select c.name, c.nit, c.city,
       (select count(*) from tribuia.apartments a where a.condominium_id = c.id) as casas,
       (select count(*) from tribuia.residents r where r.condominium_id = c.id) as residentes,
       (select string_agg(p.email, ', ')
          from tribuia.condominium_members m
          join tribuia.profiles p on p.id = m.user_id
         where m.condominium_id = c.id) as administracion
  from tribuia.condominiums c
 where c.nit = '900518186-0';
