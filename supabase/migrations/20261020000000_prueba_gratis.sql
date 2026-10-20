-- ============================================================================
-- EdiFeasy :: Prueba gratis de 7 dias para administradores
-- ----------------------------------------------------------------------------
-- Flujo:
--   1. La landing (o la pantalla de registro de administradores) crea la cuenta
--      en Supabase Auth con user_metadata.trial =
--      { condo_name, city, phone, units_range }  (sin requested_role).
--   2. Con el correo confirmado y la sesion iniciada, el dashboard llama
--      start_trial(): crea el conjunto con trial_ends_at = now() + 7 dias,
--      hace ADMINISTRATOR al usuario y marca su lead de la landing como convertido.
--   3. Cuando la prueba vence sin un plan vigente, politicas RLS restrictivas
--      bloquean los datos del conjunto. Quedan accesibles el conjunto, las
--      membresias, los planes y los pagos para que pueda pagar.
--
-- Conjuntos existentes (trial_ends_at null) no cambian: no tienen vencimiento.
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

alter table tribuia.condominiums
  add column if not exists trial_ends_at timestamptz;

-- ----------------------------------------------------------------------------
-- 1. Conjuntos sin acceso: prueba vencida y ningun plan pagado vigente
-- ----------------------------------------------------------------------------
create or replace function tribuia.expired_condominium_ids()
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select c.id
    from tribuia.condominiums c
   where c.trial_ends_at is not null
     and c.trial_ends_at <= now()
     and not exists (
       select 1
         from tribuia.subscriptions s
        where s.condominium_id = c.id
          and s.ends_at >= current_date
     );
$$;

-- ----------------------------------------------------------------------------
-- 2. Empezar la prueba (lo llama el propio administrador, una vez)
-- ----------------------------------------------------------------------------
create or replace function tribuia.start_trial(p_payload jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user      uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_meta      jsonb;
  v_name      text;
  v_condo     uuid;
  v_role      uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesion para empezar la prueba' using errcode = '42501';
  end if;

  select u.email, u.email_confirmed_at, coalesce(p_payload, u.raw_user_meta_data -> 'trial', '{}'::jsonb)
    into v_email, v_confirmed, v_meta
    from auth.users u
   where u.id = v_user;

  if v_confirmed is null then
    raise exception 'Confirma tu correo antes de empezar la prueba' using errcode = '42501';
  end if;

  -- Una prueba por cuenta: si ya la empezo, se devuelve el mismo conjunto.
  select c.id into v_condo
    from tribuia.condominiums c
   where c.created_by = v_user
     and c.trial_ends_at is not null
   limit 1;

  if v_condo is not null then
    return v_condo;
  end if;

  v_name := btrim(coalesce(v_meta ->> 'condo_name', ''));
  if length(v_name) < 3 then
    raise exception 'El nombre del conjunto es obligatorio' using errcode = '22023';
  end if;

  insert into tribuia.condominiums
    (name, city, country, phone, email, status, settings, created_by, trial_ends_at)
  values (
    left(v_name, 150),
    nullif(btrim(coalesce(v_meta ->> 'city', '')), ''),
    'Colombia',
    nullif(btrim(coalesce(v_meta ->> 'phone', '')), ''),
    lower(v_email),
    'ACTIVE',
    jsonb_strip_nulls(jsonb_build_object(
      'unitsRange', nullif(v_meta ->> 'units_range', ''),
      'createdFromTrial', true
    )),
    v_user,
    now() + interval '7 days'
  )
  returning id into v_condo;

  select id into v_role from tribuia.roles where code = 'ADMINISTRATOR';

  insert into tribuia.condominium_members (condominium_id, user_id, role_id, status, position)
  values (v_condo, v_user, v_role, 'ACTIVE', 'Administrador')
  on conflict (condominium_id, user_id, role_id) do update set status = 'ACTIVE';

  -- Lead capturado por la landing (public.leads), si la tabla existe.
  if to_regclass('public.leads') is not null then
    update public.leads
       set status = 'converted'
     where lower(email) = lower(v_email)
       and status <> 'converted';
  end if;

  return v_condo;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Bloqueo por RLS al vencer la prueba
-- ----------------------------------------------------------------------------
-- Politica RESTRICTIVA en cada tabla con condominium_id: se combina con AND con
-- las politicas existentes. Excepciones: membresias, planes, pagos y auditoria
-- (necesarios para entrar y pagar). El SUPER_ADMIN no se bloquea.
do $$
declare
  t text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema
       and tb.table_name = c.table_name
       and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'tribuia'
       and c.column_name = 'condominium_id'
       and c.table_name not in ('condominium_members', 'subscriptions', 'payments', 'audit_logs')
  loop
    execute format('drop policy if exists %1$s_trial_access on tribuia.%1$I', t);
    execute format(
      'create policy %1$s_trial_access on tribuia.%1$I as restrictive for all to authenticated
         using (condominium_id is null
                or condominium_id not in (select tribuia.expired_condominium_ids())
                or (select tribuia.is_super_admin()))
         with check (condominium_id is null
                or condominium_id not in (select tribuia.expired_condominium_ids())
                or (select tribuia.is_super_admin()))', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 4. Contexto del usuario: estado de la prueba por membresia
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
        'trial_ends_at', c.trial_ends_at,
        'has_access', c.id not in (select tribuia.expired_condominium_ids()),
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

revoke all on function tribuia.expired_condominium_ids() from public, anon;
revoke all on function tribuia.start_trial(jsonb) from public, anon;
grant execute on function tribuia.expired_condominium_ids() to authenticated, service_role;
grant execute on function tribuia.start_trial(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
