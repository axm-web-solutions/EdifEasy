-- ============================================================================
-- EdiFeasy :: Ajustes a la prueba gratis (sobre 20261020000000_prueba_gratis)
-- ----------------------------------------------------------------------------
-- 1. start_trial solo para cuentas registradas como prueba (user_metadata.trial).
--    Antes cualquier cuenta con correo confirmado, por ejemplo un residente,
--    podia crearse un conjunto y quedar como administrador.
-- 2. subscription_quote nunca cotiza $0: un conjunto de prueba aun sin
--    apartamentos cargados cotiza con el rango de unidades que declaro al
--    registrarse (settings.unitsRange, "50-100" -> 50), y como minimo 1.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

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
  v_raw       jsonb;
  v_meta      jsonb;
  v_name      text;
  v_condo     uuid;
  v_role      uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesion para empezar la prueba' using errcode = '42501';
  end if;

  select u.email, u.email_confirmed_at, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_confirmed, v_raw
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

  if jsonb_typeof(v_raw -> 'trial') is distinct from 'object' then
    raise exception 'Esta cuenta no se registro para la prueba gratis' using errcode = '42501';
  end if;

  v_meta := coalesce(p_payload, v_raw -> 'trial');
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
    execute 'update public.leads set status = ''converted''
              where lower(email) = lower($1) and status <> ''converted'''
      using v_email;
  end if;

  return v_condo;
end;
$$;

create or replace function tribuia.subscription_quote(p_condominium uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count  integer;
  v_range  integer;
  v_unit   numeric;
  v_active jsonb;
begin
  if not (tribuia.is_condominium_admin(p_condominium) or auth.role() = 'service_role') then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  select count(*) into v_count from tribuia.apartments where condominium_id = p_condominium;

  -- Sin apartamentos cargados: el rango declarado al registrarse ("50-100" -> 50).
  if v_count = 0 then
    select nullif(substring(c.settings ->> 'unitsRange' from '^\s*(\d+)'), '')::integer
      into v_range
      from tribuia.condominiums c
     where c.id = p_condominium;
    v_count := greatest(coalesce(v_range, 0), 1);
  end if;

  v_unit := case when v_count < 80 then 4500 else 4000 end;

  select to_jsonb(s) into v_active
    from tribuia.subscriptions s
   where s.condominium_id = p_condominium
   order by s.ends_at desc
   limit 1;

  return jsonb_build_object(
    'apartments_count', v_count,
    'unit_price', v_unit,
    'plans', jsonb_build_array(
      jsonb_build_object('period', 'MONTHLY',    'months', 1,  'amount', v_count * v_unit * 1),
      jsonb_build_object('period', 'SEMIANNUAL', 'months', 6,  'amount', v_count * v_unit * 6),
      jsonb_build_object('period', 'ANNUAL',     'months', 12, 'amount', v_count * v_unit * 12)
    ),
    'current', v_active
  );
end;
$$;

revoke all on function tribuia.start_trial(jsonb) from public, anon;
grant execute on function tribuia.start_trial(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
