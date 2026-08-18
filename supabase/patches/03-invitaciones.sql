-- ============================================================================
-- PARCHE 03 :: Invitaciones (el administrador crea los usuarios)
-- ----------------------------------------------------------------------------
-- Problema que resuelve:
--   Crear un usuario en Supabase Auth exige la clave secreta, que NUNCA puede
--   estar en el frontend. Sin desplegar una Edge Function, un SUPER_ADMIN no
--   tenia forma de dar de alta a los usuarios de un condominio nuevo.
--
-- Solucion: invitaciones.
--   1. El SUPER_ADMIN (o el ADMINISTRATOR del condominio) crea una invitacion:
--      correo + rol + condominio (+ apartamento opcional).
--   2. La persona se registra normalmente en /register con ese correo.
--   3. Al entrar, `claim_my_invitations()` le crea la membresia ACTIVA con el
--      rol invitado. NO pasa por la cola de aprobacion: la invitacion ya es la
--      autorizacion del administrador.
--
-- A diferencia del autoregistro, aqui SI se puede asignar cualquier rol
-- (ADMINISTRATOR, SPOKESPERSON, SECURITY, SERVICE_STAFF, OWNER, TENANT).
-- SUPER_ADMIN queda excluido: es un rol global, no de condominio.
--
-- REQUIERE el parche 01 (usa tribuia.registration_requests para cancelar una
-- solicitud de autoregistro cuando la invitacion concede el acceso).
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Es idempotente.  Verificar con:  npm run check
-- ============================================================================

-- @@BEGIN-CORE@@
-- ----------------------------------------------------------------------------
-- A. Tabla de invitaciones
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tribuia' and t.typname = 'invitation_status'
  ) then
    create type tribuia.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
  end if;
end
$$;

create table if not exists tribuia.condominium_invitations (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  email          text not null,
  role_id        uuid not null references tribuia.roles (id) on delete restrict,
  position       text,
  apartment_id   uuid references tribuia.apartments (id) on delete set null,
  status         tribuia.invitation_status not null default 'PENDING',
  invited_by     uuid references tribuia.profiles (id) on delete set null,
  accepted_by    uuid references tribuia.profiles (id) on delete set null,
  accepted_at    timestamptz,
  expires_at     timestamptz not null default now() + interval '30 days',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_invitations_condominium
  on tribuia.condominium_invitations (condominium_id, status, created_at desc);
create index if not exists idx_invitations_email
  on tribuia.condominium_invitations (lower(email), status);

-- Una sola invitacion PENDING por correo y condominio.
-- `create_invitation` guarda el correo ya normalizado a minusculas, por eso el
-- indice va sobre columnas simples: asi el ON CONFLICT no tiene que inferir una
-- expresion, que es una fuente habitual de errores en tiempo de ejecucion.
create unique index if not exists uq_invitations_pending
  on tribuia.condominium_invitations (condominium_id, email)
  where status = 'PENDING';

drop trigger if exists trg_invitations_updated_at on tribuia.condominium_invitations;
create trigger trg_invitations_updated_at
  before update on tribuia.condominium_invitations
  for each row execute function tribuia.set_updated_at();

drop trigger if exists trg_audit_invitations on tribuia.condominium_invitations;
create trigger trg_audit_invitations
  after insert or update or delete on tribuia.condominium_invitations
  for each row execute function tribuia.fn_audit('CREATE');

alter table tribuia.condominium_invitations enable row level security;

-- El invitado puede ver la suya (por correo) antes de tener membresia.
drop policy if exists invitations_select on tribuia.condominium_invitations;
create policy invitations_select on tribuia.condominium_invitations
  for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or lower(email) = lower(coalesce(
      (select p.email from tribuia.profiles p where p.id = auth.uid()), ''))
  );

drop policy if exists invitations_write on tribuia.condominium_invitations;
create policy invitations_write on tribuia.condominium_invitations
  for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- ----------------------------------------------------------------------------
-- B. Crear y revocar invitaciones
-- ----------------------------------------------------------------------------
create or replace function tribuia.create_invitation(
  p_condominium uuid,
  p_email text,
  p_role_code text,
  p_position text default null,
  p_apartment uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_role       uuid;
  v_email      text := lower(trim(coalesce(p_email, '')));
  v_invitation uuid;
  v_existing   uuid;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos para invitar usuarios a este condominio'
      using errcode = '42501';
  end if;

  if v_email = '' or v_email not like '%@%.%' then
    raise exception 'Correo electronico invalido' using errcode = '22023';
  end if;

  if p_role_code = 'SUPER_ADMIN' then
    raise exception 'SUPER_ADMIN es un rol global y no se asigna por invitacion'
      using errcode = '22023';
  end if;

  select id into v_role from tribuia.roles where code = p_role_code;
  if v_role is null then
    raise exception 'Rol invalido: %', p_role_code using errcode = '22023';
  end if;

  if p_apartment is not null and not exists (
    select 1 from tribuia.apartments a
    where a.id = p_apartment and a.condominium_id = p_condominium
  ) then
    raise exception 'El apartamento no pertenece a este condominio' using errcode = 'P0002';
  end if;

  -- Si el usuario ya existe y ya es miembro activo, no hay nada que invitar.
  select p.id into v_existing from tribuia.profiles p where lower(p.email) = v_email;
  if v_existing is not null and exists (
    select 1 from tribuia.condominium_members m
    where m.condominium_id = p_condominium
      and m.user_id = v_existing
      and m.role_id = v_role
      and m.status = 'ACTIVE'
  ) then
    raise exception 'Ese usuario ya tiene ese rol activo en el condominio' using errcode = 'P0001';
  end if;

  insert into tribuia.condominium_invitations
    (condominium_id, email, role_id, position, apartment_id, invited_by, status)
  values (p_condominium, v_email, v_role, nullif(trim(coalesce(p_position, '')), ''),
          p_apartment, auth.uid(), 'PENDING')
  on conflict (condominium_id, email) where status = 'PENDING'
    do update set role_id      = excluded.role_id,
                  position     = excluded.position,
                  apartment_id = excluded.apartment_id,
                  expires_at   = now() + interval '30 days',
                  updated_at   = now()
  returning id into v_invitation;

  return jsonb_build_object(
    'ok', true,
    'invitation_id', v_invitation,
    'email', v_email,
    'user_exists', v_existing is not null
  );
end;
$$;

create or replace function tribuia.revoke_invitation(p_invitation uuid)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_condominium uuid;
  v_status      tribuia.invitation_status;
begin
  select condominium_id, status into v_condominium, v_status
  from tribuia.condominium_invitations where id = p_invitation;

  if v_condominium is null then
    raise exception 'La invitacion no existe' using errcode = 'P0002';
  end if;

  if not tribuia.is_condominium_admin(v_condominium) then
    raise exception 'No tienes permisos sobre esta invitacion' using errcode = '42501';
  end if;

  if v_status <> 'PENDING' then
    raise exception 'Solo se pueden revocar invitaciones pendientes' using errcode = 'P0001';
  end if;

  update tribuia.condominium_invitations set status = 'REVOKED' where id = p_invitation;
  return jsonb_build_object('ok', true);
end;
$$;

-- Listado para el administrador. SECURITY DEFINER porque el invitado puede no
-- tener aun cuenta ni compartir condominio (las politicas de `profiles` no
-- permitirian resolver su nombre).
create or replace function tribuia.invitations_for_condominium(
  p_condominium uuid,
  p_status text default 'PENDING'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos para ver las invitaciones de este condominio'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by item ->> 'created_at' desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', i.id,
      'email', i.email,
      'status', i.status,
      'position', i.position,
      'role_code', r.code,
      'role_name', r.name,
      'apartment_id', a.id,
      'apartment_number', a.number,
      'building_number', b.number,
      'invited_by_name', inv.full_name,
      'accepted_by_name', acc.full_name,
      'accepted_at', i.accepted_at,
      'expires_at', i.expires_at,
      'created_at', i.created_at,
      'user_exists', exists (
        select 1 from tribuia.profiles p where lower(p.email) = lower(i.email)
      )
    ) as item
    from tribuia.condominium_invitations i
    join tribuia.roles r on r.id = i.role_id
    left join tribuia.apartments a on a.id = i.apartment_id
    left join tribuia.buildings b on b.id = a.building_id
    left join tribuia.profiles inv on inv.id = i.invited_by
    left join tribuia.profiles acc on acc.id = i.accepted_by
    where i.condominium_id = p_condominium
      and (p_status = 'ALL' or i.status::text = p_status)
  ) s;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- C. Reclamar mis invitaciones
-- ----------------------------------------------------------------------------
-- La llama el frontend al iniciar sesion. Convierte cada invitacion PENDING que
-- coincida con el correo del usuario en una membresia ACTIVA. No requiere
-- aprobacion posterior: la invitacion la creo un administrador.
-- ----------------------------------------------------------------------------
create or replace function tribuia.claim_my_invitations()
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_email   text;
  v_inv     record;
  v_claimed integer := 0;
  v_role    text;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion' using errcode = '42501';
  end if;

  select lower(email) into v_email from tribuia.profiles where id = v_user;
  if v_email is null then
    return jsonb_build_object('ok', true, 'claimed', 0);
  end if;

  -- Marcar como vencidas las que pasaron su fecha.
  update tribuia.condominium_invitations
     set status = 'EXPIRED'
   where lower(email) = v_email and status = 'PENDING' and expires_at < now();

  for v_inv in
    select i.*, r.code as role_code
    from tribuia.condominium_invitations i
    join tribuia.roles r on r.id = i.role_id
    where lower(i.email) = v_email and i.status = 'PENDING'
  loop
    v_role := v_inv.role_code;

    insert into tribuia.condominium_members
      (condominium_id, user_id, role_id, status, position)
    values (v_inv.condominium_id, v_user, v_inv.role_id, 'ACTIVE', v_inv.position)
    on conflict (condominium_id, user_id, role_id)
      do update set status = 'ACTIVE', position = excluded.position;

    -- Si la invitacion trae apartamento, se crea el vinculo correspondiente.
    if v_inv.apartment_id is not null then
      if v_role = 'OWNER' then
        insert into tribuia.apartment_owners
          (apartment_id, profile_id, ownership_percentage, is_primary, is_active)
        values (v_inv.apartment_id, v_user, 100, true, true)
        on conflict (apartment_id, profile_id) do update set is_active = true;
      elsif v_role = 'TENANT' then
        insert into tribuia.apartment_tenants (apartment_id, profile_id, is_active)
        values (v_inv.apartment_id, v_user, true)
        on conflict (apartment_id, profile_id) do update set is_active = true;
      end if;

      if v_role in ('OWNER', 'TENANT') then
        insert into tribuia.residents
          (condominium_id, apartment_id, profile_id, full_name, document_number,
           relationship, phone, email, is_active)
        select v_inv.condominium_id, v_inv.apartment_id, p.id, p.full_name, p.document_number,
               case when v_role = 'TENANT'
                    then 'TENANT'::tribuia.resident_relationship
                    else 'OWNER'::tribuia.resident_relationship end,
               p.phone, p.email, true
        from tribuia.profiles p
        where p.id = v_user
        on conflict (apartment_id, profile_id) do update set is_active = true;

        update tribuia.apartments
           set status = 'OCCUPIED'
         where id = v_inv.apartment_id and status = 'VACANT';
      end if;
    end if;

    update tribuia.condominium_invitations
       set status = 'ACCEPTED', accepted_by = v_user, accepted_at = now()
     where id = v_inv.id;

    -- Si tenia una solicitud de autoregistro pendiente para ese condominio,
    -- deja de tener sentido: la invitacion ya le dio acceso.
    update tribuia.registration_requests
       set status = 'CANCELLED',
           review_notes = 'Acceso concedido por invitacion del administrador',
           reviewed_at = now()
     where profile_id = v_user
       and condominium_id = v_inv.condominium_id
       and status = 'PENDING';

    v_claimed := v_claimed + 1;
  end loop;

  return jsonb_build_object('ok', true, 'claimed', v_claimed);
end;
$$;

-- ----------------------------------------------------------------------------
-- D. Permisos
-- ----------------------------------------------------------------------------
grant execute on function tribuia.create_invitation(uuid, text, text, text, uuid) to authenticated;
grant execute on function tribuia.revoke_invitation(uuid) to authenticated;
grant execute on function tribuia.invitations_for_condominium(uuid, text) to authenticated;
grant execute on function tribuia.claim_my_invitations() to authenticated;

grant select, insert, update, delete on tribuia.condominium_invitations to authenticated;
-- @@END-CORE@@

notify pgrst, 'reload schema';
