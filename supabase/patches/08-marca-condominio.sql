-- ============================================================================
-- PARCHE 08 :: Marca por condominio (logo + color principal)
-- ----------------------------------------------------------------------------
-- Habilita que cada condominio luzca su propio logo y color en toda la app
-- (menu, topbar, botones y favicon) una vez el usuario ingresa.
--
-- Que hace:
--   A. Recrea `current_user_context` para exponer en cada membresia el logo
--      (`condominium_logo_url`) y el color principal de la marca
--      (`condominium_primary_color`) de su condominio.
--
-- Donde se guarda la marca:
--   * logo  -> columna `tribuia.condominiums.logo_url` (ya existe).
--   * color -> `tribuia.condominiums.settings->>'primaryColor'` (jsonb, ya
--              existe; no requiere columna nueva).
--
-- Guardado en la marca:
--   al editar el condominio, el frontend escribe
--   `settings = { ..., primaryColor: '#xxxxxx' }` y `logo_url`.
--
-- La escritura sigue protegida por RLS: `condominiums_update` exige ser admin
-- del condominio (o super admin), asi que solo la administracion puede cambiar
-- la identidad visual del conjunto.
--
-- Seguro de re-ejecutar (create or replace function).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- A. CONTEXTO DE SESION CON MARCA
-- ----------------------------------------------------------------------------
create or replace function tribuia.current_user_context()
returns jsonb
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) from tribuia.profiles p where p.id = auth.uid()
    ),
    'is_super_admin', tribuia.is_super_admin(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'condominium_id', m.condominium_id,
        'condominium_name', c.name,
        'condominium_status', c.status,
        'condominium_logo_url', c.logo_url,
        'condominium_primary_color', c.settings->>'primaryColor',
        'role_id', m.role_id,
        'role_code', r.code,
        'role_name', r.name,
        'role_level', r.level,
        'status', m.status,
        'position', m.position
      ) order by r.level desc, c.name)
      from tribuia.condominium_members m
      join tribuia.condominiums c on c.id = m.condominium_id
      join tribuia.roles r on r.id = m.role_id
      where m.user_id = auth.uid() and m.status = 'ACTIVE'
    ), '[]'::jsonb),
    'apartment_ids', coalesce((
      select jsonb_agg(x) from (select tribuia.user_apartment_ids() as x) s
      where x is not null
    ), '[]'::jsonb)
  );
$$;