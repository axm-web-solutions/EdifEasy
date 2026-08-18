-- ============================================================================
-- PARCHE 06 :: Catalogo definitivo de usuarios de prueba
-- ----------------------------------------------------------------------------
-- Reemplaza a `npm run seed`, que necesita una clave secreta de Auth.
-- Aqui solo hace falta el SQL Editor.
--
-- Que hace:
--   A. BORRA los usuarios de ejemplo que sobran (12 direcciones @edifeasy.com
--      que no se usan). Solo esas: ninguna cuenta real se toca.
--   B. CREA o ACTUALIZA los 12 que se quedan, con una contrasena conocida.
--      Si la cuenta ya existe, le reescribe la contrasena para que la lista de
--      credenciales del README sea cierta y no una suposicion.
--   C. Reconstruye el perfil en tribuia.profiles por si falta.
--   D. Al final lista el resultado.
--
-- Escribe en tribuia y en auth (crear una cuenta exige auth.users: es donde
-- Supabase guarda las credenciales). NO toca public ni ningun otro esquema.
--
-- Orden recomendado:
--   1) supabase/schema.sql
--   2) ESTE archivo
--   3) supabase/seed.sql          (condominio demo, gastos, solicitudes...)
--   4) supabase/patches/05-promover-administrador.sql   (si quieres que tu
--      propia cuenta tambien sea administradora)
--
-- Es idempotente: puedes ejecutarlo varias veces.
-- ============================================================================

create extension if not exists pgcrypto;

do $usuarios$
declare
  -- Cambia la contrasena aqui si quieres otra. Se aplica a los 12 usuarios.
  v_password text := 'EdiFeasy2024*';

  -- Direcciones que se eliminan. El seed no las necesita: sus bucles
  -- comprueban `if v_profile is not null` antes de insertar, asi que
  -- simplemente se omiten y los apartamentos quedan libres.
  v_sobran text[] := array[
    'propietario4@edifeasy.com',  'propietario5@edifeasy.com',
    'propietario6@edifeasy.com',  'propietario7@edifeasy.com',
    'propietario8@edifeasy.com',  'propietario9@edifeasy.com',
    'propietario10@edifeasy.com', 'propietario11@edifeasy.com',
    'propietario12@edifeasy.com',
    'arrendatario3@edifeasy.com', 'arrendatario4@edifeasy.com',
    'arrendatario5@edifeasy.com'
  ];

  r          record;
  v_id       uuid;
  v_borrados integer;
begin
  -- ==========================================================================
  -- A. Quitar los que sobran
  -- ==========================================================================
  -- Borrar de auth.users arrastra en cascada su perfil, membresias, propiedad
  -- de apartamentos, arrendamientos y fichas de residente: las claves ajenas
  -- estan declaradas `on delete cascade`. Los apartamentos quedan sin dueno,
  -- que es justo lo que hace falta para probar el autoregistro.
  delete from auth.users
  where lower(email) = any (select lower(x) from unnest(v_sobran) as x);

  get diagnostics v_borrados = row_count;
  raise notice 'Usuarios de ejemplo eliminados: % (de % direcciones)', v_borrados, array_length(v_sobran, 1);

  -- ==========================================================================
  -- B. Crear o actualizar los 12 que se quedan
  -- ==========================================================================
  for r in
    select * from (
      values
        ('superadmin@edifeasy.com',   'Sofia Nunez',            '+57 300 000 0001', '1000000001'),
        ('admin@edifeasy.com',        'Carlos Mejia',           '+57 300 000 0002', '1000000002'),
        ('vocero@edifeasy.com',       'Laura Cardenas',         '+57 300 000 0003', '1000000003'),
        ('celador1@edifeasy.com',     'Jose Pineda',            '+57 300 000 0004', '1000000004'),
        ('celador2@edifeasy.com',     'Marta Quintero',         '+57 300 000 0005', '1000000005'),
        ('servicios1@edifeasy.com',   'Andres Rojas',           '+57 300 000 0006', '1000000006'),
        ('servicios2@edifeasy.com',   'Diana Salazar',          '+57 300 000 0007', '1000000007'),
        ('propietario1@edifeasy.com', 'Propietario 1 Restrepo', '+57 300 100 1001', '10100001'),
        ('propietario2@edifeasy.com', 'Propietario 2 Restrepo', '+57 300 100 1002', '10100002'),
        ('propietario3@edifeasy.com', 'Propietario 3 Restrepo', '+57 300 100 1003', '10100003'),
        ('arrendatario1@edifeasy.com','Arrendatario 1 Gomez',   '+57 301 200 2001', '20200001'),
        ('arrendatario2@edifeasy.com','Arrendatario 2 Gomez',   '+57 301 200 2002', '20200002')
    ) as t(email, full_name, phone, document_number)
  loop
    select u.id into v_id from auth.users u where lower(u.email) = lower(r.email);

    if v_id is null then
      v_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated',
        'authenticated',
        lower(r.email),
        crypt(v_password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object(
          'full_name', r.full_name,
          'phone', r.phone,
          'document_number', r.document_number,
          'document_type', 'CC'
        ),
        now(), now(),
        '', '', '', ''
      );

      -- La identidad del proveedor `email`. La Admin API la crea siempre; al
      -- insertar a mano hay que hacerlo tambien, o algunos flujos de GoTrue
      -- (vinculacion de proveedores, recuperacion) no encuentran la cuenta.
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      )
      values (
        v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', lower(r.email), 'email_verified', true),
        'email', null, now(), now()
      )
      on conflict do nothing;

      raise notice 'creado      %', r.email;
    else
      -- Ya existia: se reescribe la contrasena para que la lista sea exacta.
      update auth.users
      set encrypted_password = crypt(v_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at         = now()
      where id = v_id;

      raise notice 'contrasena actualizada  %', r.email;
    end if;

    -- ========================================================================
    -- C. Perfil en tribuia (normalmente lo crea el trigger; esto cubre las
    --    cuentas creadas antes de instalarlo)
    -- ========================================================================
    insert into tribuia.profiles (id, email, full_name, phone, document_number, document_type)
    values (v_id, lower(r.email), r.full_name, r.phone, r.document_number, 'CC')
    on conflict (id) do update
      set email           = excluded.email,
          full_name       = excluded.full_name,
          phone           = excluded.phone,
          document_number = excluded.document_number;
  end loop;

  raise notice 'LISTO. Contrasena de los 12 usuarios: %', v_password;
end
$usuarios$;

notify pgrst, 'reload schema';

-- ============================================================================
-- D. Resultado: los 12 usuarios con su rol y su estado
-- ============================================================================
select p.email,
       p.full_name                                                        as nombre,
       coalesce(string_agg(distinct gr.code, ', '), '-')                  as rol_global,
       coalesce(string_agg(distinct mr.code, ', '), 'sin membresia')      as rol_en_condominio,
       (select count(*) from tribuia.apartment_owners o
         where o.profile_id = p.id and o.is_active)                       as apartamentos_propios,
       (select count(*) from tribuia.apartment_tenants t
         where t.profile_id = p.id and t.is_active)                       as apartamentos_arrendados
from tribuia.profiles p
left join tribuia.user_roles ur          on ur.user_id = p.id
left join tribuia.roles gr               on gr.id = ur.role_id
left join tribuia.condominium_members m  on m.user_id = p.id and m.status = 'ACTIVE'
left join tribuia.roles mr               on mr.id = m.role_id
where p.email like '%@edifeasy.com'
group by p.id, p.email, p.full_name
order by p.email;
