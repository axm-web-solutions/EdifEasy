-- ============================================================================
-- PARCHE 05 :: Convertir una cuenta existente en administradora
-- ----------------------------------------------------------------------------
-- Para que sirve:
--   desbloquear el sistema sin `npm run seed`. El seed necesita una clave
--   secreta valida (Admin API de Auth); esto solo necesita el SQL Editor.
--
--   Deja la cuenta con rol global SUPER_ADMIN, que en este modelo alcanza para
--   todo: tribuia.has_role() empieza por `is_super_admin(p_user) or ...`, asi
--   que aprueba inscripciones de cualquier condominio, crea condominios y
--   gestiona usuarios. Ademas le crea la membresia ADMINISTRATOR cuando hay un
--   solo condominio ACTIVE, porque las notificaciones de solicitudes nuevas se
--   envian a los miembros con rol ADMINISTRATOR o SPOKESPERSON: sin membresia
--   el aviso no le llegaria a nadie.
--
-- Toca UNICAMENTE el esquema tribuia. De auth.users solo LEE, para encontrar el
-- id de la cuenta y reconstruir el perfil si falta.
--
-- Uso:
--   1) Cambia v_email por el correo de la cuenta (ya debe existir en Auth).
--   2) Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run.
--   3) Entra en la aplicacion con esa cuenta.
--
-- Es idempotente: puedes ejecutarlo varias veces.
-- ============================================================================

do $promote$
declare
  v_email  text := 'superadmin@edifeasy.com';  -- <-- CAMBIA ESTO
  v_user   uuid;
  v_role   uuid;
  v_condo  uuid;
  v_condos integer;
  v_name   text;
begin
  -- 1. La cuenta se busca en auth.users, no en profiles.
  --    Es la fuente de verdad: si la cuenta existe pero se creo antes de
  --    instalar el trigger on_auth_user_created, no tiene perfil todavia y
  --    buscarla en profiles daria "no existe" siendo falso.
  select u.id into v_user
  from auth.users u
  where lower(u.email) = lower(trim(v_email));

  if v_user is null then
    raise exception 'No existe ninguna cuenta en Auth con el correo %. Creala primero en /register o en Authentication > Users.', v_email;
  end if;

  -- 2. Reconstruir el perfil si falta (mismo caso que el parche 04).
  insert into tribuia.profiles (id, email, full_name, phone, document_number, document_type, metadata)
  select u.id,
         u.email,
         coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
         u.raw_user_meta_data ->> 'phone',
         u.raw_user_meta_data ->> 'document_number',
         coalesce(u.raw_user_meta_data ->> 'document_type', 'CC'),
         jsonb_build_object('requested_role', nullif(u.raw_user_meta_data ->> 'requested_role', ''))
  from auth.users u
  where u.id = v_user
  on conflict do nothing;

  if not exists (select 1 from tribuia.profiles p where p.id = v_user) then
    raise exception 'No se pudo crear el perfil de %. Revisa si el correo esta repetido en auth.users.', v_email;
  end if;

  select full_name into v_name from tribuia.profiles where id = v_user;

  -- 3. Rol global SUPER_ADMIN.
  select id into v_role from tribuia.roles where code = 'SUPER_ADMIN';
  if v_role is null then
    raise exception 'No existe el rol SUPER_ADMIN. Ejecuta primero supabase/schema.sql';
  end if;

  insert into tribuia.user_roles (user_id, role_id)
  values (v_user, v_role)
  on conflict (user_id, role_id) do nothing;

  -- 4. Membresia ADMINISTRATOR, solo si no hay ambiguedad sobre el condominio.
  select count(*) into v_condos from tribuia.condominiums where status = 'ACTIVE';

  if v_condos = 1 then
    select id into v_condo from tribuia.condominiums where status = 'ACTIVE';

    insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position)
    select v_condo, v_user, r.id, 'ACTIVE', 'Administrador'
    from tribuia.roles r
    where r.code = 'ADMINISTRATOR'
    on conflict (condominium_id, user_id, role_id) do update set status = 'ACTIVE';

    raise notice 'Membresia ADMINISTRATOR creada en el condominio activo.';
  elsif v_condos = 0 then
    raise notice 'No hay condominios ACTIVE: la cuenta entra como SUPER_ADMIN y podra crear el primero desde /condominiums.';
  else
    raise notice 'Hay % condominios ACTIVE: no se creo membresia para no elegir por ti. Como SUPER_ADMIN ya los ve todos; si quieres una membresia concreta, hazla desde /users.', v_condos;
  end if;

  raise notice 'LISTO: % (%) es SUPER_ADMIN. Inicia sesion con esa cuenta.', v_email, coalesce(v_name, 'sin nombre');
end
$promote$;

notify pgrst, 'reload schema';

-- ============================================================================
-- Comprobacion: la cuenta debe aparecer con SUPER_ADMIN.
-- ============================================================================
select p.email,
       p.full_name                                              as nombre,
       coalesce(string_agg(distinct gr.code, ', '), 'ninguno')   as roles_globales,
       coalesce(string_agg(distinct mr.code || ' en ' || c.name, ', '), 'sin membresia') as membresias
from tribuia.profiles p
left join tribuia.user_roles ur          on ur.user_id = p.id
left join tribuia.roles gr               on gr.id = ur.role_id
left join tribuia.condominium_members m  on m.user_id = p.id and m.status = 'ACTIVE'
left join tribuia.roles mr               on mr.id = m.role_id
left join tribuia.condominiums c         on c.id = m.condominium_id
where exists (select 1 from tribuia.user_roles u2
              join tribuia.roles r2 on r2.id = u2.role_id
              where u2.user_id = p.id and r2.code = 'SUPER_ADMIN')
group by p.id, p.email, p.full_name
order by p.email;
