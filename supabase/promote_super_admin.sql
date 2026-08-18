-- ============================================================================
-- EdiFeasy :: Promover un usuario a SUPER_ADMIN
-- ----------------------------------------------------------------------------
-- Uso (SQL Editor, despues de ejecutar supabase/schema.sql):
--   1) Crea la cuenta en la app (/register) o en Auth -> Users.
--   2) Cambia el correo de abajo por el de esa cuenta.
--   3) Ejecuta este bloque. El usuario quedara con rol global SUPER_ADMIN:
--      puede crear condominios, ver todas las organizaciones y gestionar
--      usuarios/permisos. No necesita estar vinculado a ningun condominio.
-- ============================================================================

do $$
declare
  v_email     text := 'superadmin@edifeasy.com';  -- <-- cambia por tu correo
  v_user      uuid;
  v_role      uuid;
begin
  select id into v_user from tribuia.profiles where lower(email) = lower(trim(v_email));
  if v_user is null then
    raise exception 'No existe un usuario registrado con el correo %. Primero crea la cuenta en la plataforma.', v_email;
  end if;

  select id into v_role from tribuia.roles where code = 'SUPER_ADMIN';
  if v_role is null then
    raise exception 'No existe el rol SUPER_ADMIN. Ejecuta primero supabase/schema.sql';
  end if;

  insert into tribuia.user_roles (user_id, role_id)
  values (v_user, v_role)
  on conflict (user_id, role_id) do nothing;

  raise notice 'OK: % ahora es SUPER_ADMIN', v_email;
end;
$$;