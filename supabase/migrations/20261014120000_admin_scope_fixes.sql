-- ============================================================================
-- Alcance de escritura por condominio (administrador solo en sus conjuntos)
-- ----------------------------------------------------------------------------
-- Cierra los huecos encontrados al probar que un ADMINISTRATOR (o cualquier
-- usuario) solo puede crear, modificar o borrar datos de los condominios donde
-- es miembro activo, y que el SUPER_ADMIN puede operar en todos:
--
--   1. Integridad de referencias: visitors, admin_fees, condominium_invitations y
--      registration_requests no validaban que el apartamento/bloque fuera del
--      mismo condominio de la fila.
--   2. Columnas de tenant inmutables: un UPDATE ya no puede mover una fila a otro
--      condominio (condominium_id) ni a otro padre (conversation_id, request_id,
--      meeting_id, report_id, purchase_id). Solo SUPER_ADMIN o la service role.
--   3. Politicas que permitian escribir fuera del condominio propio o tras dejar
--      de ser miembro: meeting_signatures, conversation_participants, messages,
--      requests, incidents, notifications, audit_logs.
--   4. Roles globales (SUPER_ADMIN) no se asignan como membresia ni invitacion.
--   5. profiles: el usuario no puede cambiar su correo (salvo para igualarlo al
--      de auth.users) ni su estado. Evita reclamar invitaciones ajenas.
--   6. Borrado de condominios por SUPER_ADMIN: la auditoria ya no rompe el
--      borrado en cascada y los pagos no bloquean el borrado del conjunto.
--
-- Idempotente. Requiere 20261014000000_pago_multas.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Integridad de referencias multi-tenant
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['visitors', 'admin_fees', 'condominium_invitations', 'registration_requests']
  loop
    execute format('drop trigger if exists trg_%1$s_tenant_ref on tribuia.%1$I', t);
    execute format(
      'create trigger trg_%1$s_tenant_ref before insert or update on tribuia.%1$I
       for each row execute function tribuia.tg_assert_tenant_reference()', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 2. Columnas de tenant inmutables para usuarios finales
-- ----------------------------------------------------------------------------
-- tg_argv = columnas que no pueden cambiar en un UPDATE. auth.uid() nulo es la
-- service role, el SQL Editor o un trigger de sistema: no se restringe.
create or replace function tribuia.tg_lock_tenant_columns()
returns trigger
language plpgsql
set search_path = tribuia, public, pg_temp
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_col text;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Primero se comparan las columnas (barato); is_super_admin solo si cambiaron.
  foreach v_col in array tg_argv loop
    if (v_new -> v_col) is distinct from (v_old -> v_col) and not tribuia.is_super_admin() then
      raise exception 'No se puede cambiar % de un registro de %', v_col, tg_table_name
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('condominium_members',       'condominium_id'),
      ('buildings',                 'condominium_id'),
      ('apartments',                'condominium_id'),
      ('residents',                 'condominium_id'),
      ('vehicles',                  'condominium_id'),
      ('pets',                      'condominium_id'),
      ('visitors',                  'condominium_id'),
      ('alerts',                    'condominium_id'),
      ('announcements',             'condominium_id'),
      ('notifications',             'condominium_id'),
      ('conversations',             'condominium_id'),
      ('messages',                  'condominium_id,conversation_id'),
      ('requests',                  'condominium_id'),
      ('incidents',                 'condominium_id'),
      ('expense_categories',        'condominium_id'),
      ('expenses',                  'condominium_id'),
      ('purchases',                 'condominium_id'),
      ('fines',                     'condominium_id'),
      ('document_categories',       'condominium_id'),
      ('documents',                 'condominium_id'),
      ('audit_logs',                'condominium_id'),
      ('meetings',                  'condominium_id'),
      ('reports',                   'condominium_id'),
      ('registration_requests',     'condominium_id'),
      ('condominium_invitations',   'condominium_id'),
      ('admin_fees',                'condominium_id'),
      ('conversation_participants', 'conversation_id'),
      ('request_comments',          'request_id'),
      ('meeting_signatures',        'meeting_id'),
      ('report_images',             'report_id'),
      ('purchase_items',            'purchase_id')
    ) as t(tbl, cols)
  loop
    execute format('drop trigger if exists trg_%1$s_lock_tenant on tribuia.%1$I', spec.tbl);
    execute format(
      'create trigger trg_%1$s_lock_tenant before update on tribuia.%1$I
       for each row execute function tribuia.tg_lock_tenant_columns(%2$s)',
      spec.tbl,
      (select string_agg(quote_literal(c), ', ') from unnest(string_to_array(spec.cols, ',')) c));
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 3. Politicas
-- ----------------------------------------------------------------------------
create or replace function tribuia.meeting_condominium(p_meeting uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select m.condominium_id from tribuia.meetings m where m.id = p_meeting;
$$;

create or replace function tribuia.conversation_creator(p_conversation uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select c.created_by from tribuia.conversations c where c.id = p_conversation;
$$;

-- 3.1 meeting_signatures: el firmante solo firma actas de SU condominio.
drop policy if exists meeting_signatures_insert on tribuia.meeting_signatures;
create policy meeting_signatures_insert on tribuia.meeting_signatures for insert to authenticated
  with check (
    tribuia.has_role(tribuia.meeting_condominium(meeting_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
    or (
      profile_id = (select auth.uid())
      and tribuia.user_can_access_condominium(tribuia.meeting_condominium(meeting_id))
    )
  );

drop policy if exists meeting_signatures_update on tribuia.meeting_signatures;
create policy meeting_signatures_update on tribuia.meeting_signatures for update to authenticated
  using (
    tribuia.has_role(tribuia.meeting_condominium(meeting_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
    or (
      profile_id = (select auth.uid())
      and tribuia.user_can_access_condominium(tribuia.meeting_condominium(meeting_id))
    )
  )
  with check (
    tribuia.has_role(tribuia.meeting_condominium(meeting_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
    or (
      profile_id = (select auth.uid())
      and tribuia.user_can_access_condominium(tribuia.meeting_condominium(meeting_id))
    )
  );

-- 3.2 conversation_participants: solo el creador, un participante o la
-- administracion agregan personas, y solo miembros del mismo condominio.
drop policy if exists participants_select on tribuia.conversation_participants;
create policy participants_select on tribuia.conversation_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or tribuia.is_conversation_participant(conversation_id)
    or tribuia.is_condominium_admin(tribuia.conversation_condominium(conversation_id))
  );

drop policy if exists participants_insert on tribuia.conversation_participants;
create policy participants_insert on tribuia.conversation_participants for insert to authenticated
  with check (
    tribuia.user_can_access_condominium(tribuia.conversation_condominium(conversation_id))
    and tribuia.user_can_access_condominium(tribuia.conversation_condominium(conversation_id), user_id)
    and (
      tribuia.conversation_creator(conversation_id) = (select auth.uid())
      or tribuia.is_conversation_participant(conversation_id)
      or tribuia.is_condominium_admin(tribuia.conversation_condominium(conversation_id))
    )
  );

-- 3.3 messages: solo el autor edita su mensaje, mientras siga en el condominio.
drop policy if exists messages_update on tribuia.messages;
create policy messages_update on tribuia.messages for update to authenticated
  using (sender_id = (select auth.uid()) and tribuia.user_can_access_condominium(condominium_id))
  with check (sender_id = (select auth.uid()) and tribuia.user_can_access_condominium(condominium_id));

-- 3.4 requests / incidents: el autor o asignado edita solo si sigue siendo
-- miembro activo del condominio.
drop policy if exists requests_update on tribuia.requests;
create policy requests_update on tribuia.requests for update to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SERVICE_STAFF'])
    or (
      tribuia.user_can_access_condominium(condominium_id)
      and (assigned_to = (select auth.uid()) or created_by = (select auth.uid()))
    )
  )
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SERVICE_STAFF'])
    or (
      tribuia.user_can_access_condominium(condominium_id)
      and (assigned_to = (select auth.uid()) or created_by = (select auth.uid()))
    )
  );

drop policy if exists incidents_update on tribuia.incidents;
create policy incidents_update on tribuia.incidents for update to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
    or (
      tribuia.user_can_access_condominium(condominium_id)
      and (reported_by = (select auth.uid()) or assigned_to = (select auth.uid()))
    )
  )
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
    or (
      tribuia.user_can_access_condominium(condominium_id)
      and (reported_by = (select auth.uid()) or assigned_to = (select auth.uid()))
    )
  );

-- 3.5 notifications: la administracion solo notifica a miembros de su
-- condominio; el usuario solo se notifica a si mismo en condominios propios.
drop policy if exists notifications_insert on tribuia.notifications;
create policy notifications_insert on tribuia.notifications for insert to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and (condominium_id is null or tribuia.user_can_access_condominium(condominium_id))
    )
    or (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
      and tribuia.user_can_access_condominium(condominium_id, user_id)
    )
  );

-- 3.6 audit_logs: no se puede escribir en la auditoria de otro condominio.
drop policy if exists audit_logs_insert on tribuia.audit_logs;
create policy audit_logs_insert on tribuia.audit_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (condominium_id is null or tribuia.user_can_access_condominium(condominium_id))
  );

-- ----------------------------------------------------------------------------
-- 4. Roles globales fuera de membresias e invitaciones
-- ----------------------------------------------------------------------------
create or replace function tribuia.tg_reject_global_role()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if exists (select 1 from tribuia.roles r where r.id = new.role_id and r.is_global) then
    raise exception 'Un rol global (SUPER_ADMIN) no se asigna por condominio'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_condominium_members_global_role on tribuia.condominium_members;
create trigger trg_condominium_members_global_role
  before insert or update of role_id on tribuia.condominium_members
  for each row execute function tribuia.tg_reject_global_role();

drop trigger if exists trg_invitations_global_role on tribuia.condominium_invitations;
create trigger trg_invitations_global_role
  before insert or update of role_id on tribuia.condominium_invitations
  for each row execute function tribuia.tg_reject_global_role();

-- ----------------------------------------------------------------------------
-- 5. profiles: correo y estado no los cambia el propio usuario
-- ----------------------------------------------------------------------------
-- `claim_my_invitations` y `add_member_by_email` confian en profiles.email: si
-- el usuario pudiera cambiarlo, reclamaria invitaciones de otra persona (por
-- ejemplo, una de ADMINISTRATOR en otro conjunto).
create or replace function tribuia.tg_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if auth.uid() is null or tribuia.is_super_admin() then
    return new;
  end if;

  if lower(new.email) is distinct from lower(old.email)
     and lower(new.email) is distinct from (select lower(u.email) from auth.users u where u.id = new.id) then
    raise exception 'El correo se cambia desde la cuenta de acceso, no desde el perfil'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Solo un super administrador cambia el estado de un perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on tribuia.profiles;
create trigger trg_profiles_guard
  before update on tribuia.profiles
  for each row execute function tribuia.tg_profiles_guard();

-- ----------------------------------------------------------------------------
-- 6. Borrado de condominios por SUPER_ADMIN
-- ----------------------------------------------------------------------------
-- 6.1 La auditoria de las filas borradas en cascada apuntaba al condominio que
-- se estaba borrando y la FK audit_logs.condominium_id abortaba el borrado. Si
-- el condominio ya no existe, el registro queda sin condominio (el id sigue en
-- metadata.record).
create or replace function tribuia.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row     jsonb;
  v_action  tribuia.audit_action;
  v_condo   uuid;
  v_entity  uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_action := 'DELETE';
  elsif tg_op = 'UPDATE' then
    v_row := to_jsonb(new);
    v_action := 'UPDATE';
  else
    v_row := to_jsonb(new);
    v_action := coalesce(nullif(tg_argv[0], '')::tribuia.audit_action, 'CREATE');
  end if;

  v_condo := tribuia.safe_uuid(v_row ->> 'condominium_id');
  v_entity := tribuia.safe_uuid(v_row ->> 'id');

  if v_condo is not null and not exists (select 1 from tribuia.condominiums c where c.id = v_condo) then
    v_condo := null;
  end if;

  insert into tribuia.audit_logs (user_id, condominium_id, action, entity, entity_id, metadata)
  values (auth.uid(), v_condo, v_action, tg_table_name, v_entity,
          jsonb_build_object('op', tg_op, 'record', v_row));

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- 6.2 payments.admin_fee_id / fine_id eran ON DELETE SET NULL, lo que choca con
-- payments_target_check y abortaba el borrado del conjunto (y de bloques,
-- apartamentos, cuotas o multas con intentos de pago). Con NO ACTION la
-- verificacion ocurre al final de la sentencia: borrar el condominio completo
-- (que borra tambien sus pagos) funciona, y borrar una cuota o multa con pagos
-- se rechaza con un error de FK claro (se debe anular, no borrar).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'payments_admin_fee_id_fkey' and conrelid = 'tribuia.payments'::regclass
      and confdeltype <> 'a'
  ) then
    alter table tribuia.payments drop constraint payments_admin_fee_id_fkey;
    alter table tribuia.payments add constraint payments_admin_fee_id_fkey
      foreign key (admin_fee_id) references tribuia.admin_fees (id);
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'payments_fine_id_fkey' and conrelid = 'tribuia.payments'::regclass
      and confdeltype <> 'a'
  ) then
    alter table tribuia.payments drop constraint payments_fine_id_fkey;
    alter table tribuia.payments add constraint payments_fine_id_fkey
      foreign key (fine_id) references tribuia.fines (id);
  end if;
end
$$;

-- Funciones de trigger: no se invocan por RPC.
revoke execute on function tribuia.tg_lock_tenant_columns() from public, anon, authenticated;
revoke execute on function tribuia.tg_reject_global_role() from public, anon, authenticated;
revoke execute on function tribuia.tg_profiles_guard() from public, anon, authenticated;

notify pgrst, 'reload schema';
