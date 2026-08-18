-- ============================================================================
-- EdiFeasy :: Crear usuarios de ejemplo (para pruebas)
-- ----------------------------------------------------------------------------
-- Sustituye a `npm run seed` (que requiere la service role key). Inserta los
-- usuarios del catalogo directamente en `auth.users`; el trigger
-- `on_auth_user_created` -> `handle_new_user` crea su perfil en
-- `tribuia.profiles` automaticamente.
--
-- Uso (SQL Editor, DESPUES de supabase/schema.sql):
--   1) supabase/schema.sql
--   2) ESTE archivo        (crea los usuarios de ejemplo)
--   3) supabase/seed.sql   (genera el condominio demo con edificios,
--                           apartamentos, gastos, solicitudes, etc.)
--
-- Password de todos los usuarios de ejemplo: EdiFeasy2024*
-- Es idempotente: no duplica usuarios que ya existan.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Insercion real en auth.users (el trigger crea el perfil en tribuia.profiles)
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select email, full_name, phone, document_number from (
      values
        ('superadmin@edifeasy.com', 'Sofia Nunez', '+57 300 000 0001', '1000000001'),
        ('admin@edifeasy.com', 'Carlos Mejia', '+57 300 000 0002', '1000000002'),
        ('vocero@edifeasy.com', 'Laura Cardenas', '+57 300 000 0003', '1000000003'),
        ('celador1@edifeasy.com', 'Jose Pineda', '+57 300 000 0004', '1000000004'),
        ('celador2@edifeasy.com', 'Marta Quintero', '+57 300 000 0005', '1000000005'),
        ('servicios1@edifeasy.com', 'Andres Rojas', '+57 300 000 0006', '1000000006'),
        ('servicios2@edifeasy.com', 'Diana Salazar', '+57 300 000 0007', '1000000007'),
        ('propietario1@edifeasy.com', 'Propietario 1 Restrepo', '+57 300 100 1001', '10100001'),
        ('propietario2@edifeasy.com', 'Propietario 2 Restrepo', '+57 300 100 1002', '10100002'),
        ('propietario3@edifeasy.com', 'Propietario 3 Restrepo', '+57 300 100 1003', '10100003'),
        ('propietario4@edifeasy.com', 'Propietario 4 Restrepo', '+57 300 100 1004', '10100004'),
        ('propietario5@edifeasy.com', 'Propietario 5 Restrepo', '+57 300 100 1005', '10100005'),
        ('propietario6@edifeasy.com', 'Propietario 6 Restrepo', '+57 300 100 1006', '10100006'),
        ('propietario7@edifeasy.com', 'Propietario 7 Restrepo', '+57 300 100 1007', '10100007'),
        ('propietario8@edifeasy.com', 'Propietario 8 Restrepo', '+57 300 100 1008', '10100008'),
        ('propietario9@edifeasy.com', 'Propietario 9 Restrepo', '+57 300 100 1009', '10100009'),
        ('propietario10@edifeasy.com', 'Propietario 10 Restrepo', '+57 300 100 1010', '10100010'),
        ('propietario11@edifeasy.com', 'Propietario 11 Restrepo', '+57 300 100 1011', '10100011'),
        ('propietario12@edifeasy.com', 'Propietario 12 Restrepo', '+57 300 100 1012', '10100012'),
        ('arrendatario1@edifeasy.com', 'Arrendatario 1 Gomez', '+57 301 200 2001', '20200001'),
        ('arrendatario2@edifeasy.com', 'Arrendatario 2 Gomez', '+57 301 200 2002', '20200002'),
        ('arrendatario3@edifeasy.com', 'Arrendatario 3 Gomez', '+57 301 200 2003', '20200003'),
        ('arrendatario4@edifeasy.com', 'Arrendatario 4 Gomez', '+57 301 200 2004', '20200004'),
        ('arrendatario5@edifeasy.com', 'Arrendatario 5 Gomez', '+57 301 200 2005', '20200005')
    ) as t(email, full_name, phone, document_number)
  loop
    -- Solo inserta si el correo no existe aun en auth.users.
    if not exists (select 1 from auth.users u where lower(u.email) = lower(r.email)) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        email_change, email_change_token_new, recovery_token
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        r.email,
        crypt('EdiFeasy2024*', gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object(
          'full_name', r.full_name,
          'phone', r.phone,
          'document_number', r.document_number,
          'document_type', 'CC'
        ),
        now(), now(),
        '',
        '', '', ''
      );
      raise notice 'Creado: %', r.email;
    else
      raise notice 'Ya existe: % (se omite)', r.email;
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- Resumen
-- ============================================================================
select count(*) as usuarios_auth
from auth.users u
where lower(u.email) in (
  select lower(email)
  from (
    values
      ('superadmin@edifeasy.com'), ('admin@edifeasy.com'), ('vocero@edifeasy.com'),
      ('celador1@edifeasy.com'), ('celador2@edifeasy.com'),
      ('servicios1@edifeasy.com'), ('servicios2@edifeasy.com'),
      ('propietario1@edifeasy.com'), ('propietario2@edifeasy.com'),
      ('propietario3@edifeasy.com'), ('propietario4@edifeasy.com'),
      ('propietario5@edifeasy.com'), ('propietario6@edifeasy.com'),
      ('propietario7@edifeasy.com'), ('propietario8@edifeasy.com'),
      ('propietario9@edifeasy.com'), ('propietario10@edifeasy.com'),
      ('propietario11@edifeasy.com'), ('propietario12@edifeasy.com'),
      ('arrendatario1@edifeasy.com'), ('arrendatario2@edifeasy.com'),
      ('arrendatario3@edifeasy.com'), ('arrendatario4@edifeasy.com'),
      ('arrendatario5@edifeasy.com')
  ) as t(email)
)
and u.encrypted_password is not null and u.encrypted_password <> '';

select 'perfiles_en_tribuia' as tabla, count(*) from tribuia.profiles
union all select 'roles', count(*) from tribuia.roles;