-- ============================================================================
-- Resumenes agregados de listados y panel de plataforma (SUPER_ADMIN)
-- ----------------------------------------------------------------------------
--   A. fines_summary, admin_fees_summary, expenses_summary: totales de las
--      tarjetas calculados en el servidor sobre TODAS las filas que cumplen los
--      filtros del listado (antes se sumaba solo la pagina visible).
--      Los filtros replican `applyListParams` (src/services/query.ts):
--        * busqueda: ILIKE '%termino%' sobre las searchColumns del servicio, con
--          el termino saneado igual que `escapeSearchTerm` (`,` `(` `)` `%` ->
--          espacio, trim) y `*` como comodin (PostgREST lo traduce a `%`).
--        * filtros por igualdad (null = sin filtro).
--        * rango de fechas inclusivo sobre la dateColumn del servicio.
--   B. platform_overview: totales de la plataforma y detalle por condominio.
--
-- Idempotente. Requiere 20261014120000_admin_scope_fixes.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Indices para los resumenes (filtro por condominio + rango de fechas)
-- ----------------------------------------------------------------------------
create index if not exists idx_fines_condominium_date on tribuia.fines (condominium_id, fine_date desc);
create index if not exists idx_admin_fees_condominium_due on tribuia.admin_fees (condominium_id, due_date desc);
-- expenses ya tiene idx_expenses_condominium (condominium_id, expense_date desc).
-- Ultimo pago aprobado por condominio (platform_overview).
create index if not exists idx_payments_condominium_paid on tribuia.payments (condominium_id, paid_at desc)
  where status = 'APPROVED';

-- ----------------------------------------------------------------------------
-- 2. Patron de busqueda equivalente al del frontend
-- ----------------------------------------------------------------------------
-- Devuelve null si no hay termino util (sin filtro de busqueda).
create or replace function tribuia.list_search_pattern(p_search text)
returns text
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select case when t = '' then null else '%' || replace(t, '*', '%') || '%' end
  from (
    select regexp_replace(regexp_replace(coalesce(p_search, ''), '[,()%]', ' ', 'g'), '^\s+|\s+$', '', 'g') as t
  ) s;
$$;

-- ----------------------------------------------------------------------------
-- 3. Resumen de multas
-- ----------------------------------------------------------------------------
-- Visibilidad igual a la politica fines_select: administracion y vocero ven el
-- conjunto completo; el resto solo las multas de sus apartamentos.
create or replace function tribuia.fines_summary(
  p_condominium uuid,
  p_status      text default null,
  p_apartment   uuid default null,
  p_from        date default null,
  p_to          date default null,
  p_search      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_all     boolean;
  v_pattern text := tribuia.list_search_pattern(p_search);
  v_result  jsonb;
begin
  v_all := tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'SPOKESPERSON'], v_uid);

  if not v_all and not (
    tribuia.user_can_access_condominium(p_condominium, v_uid)
    or exists (
      select 1 from tribuia.apartments a
       where a.condominium_id = p_condominium
         and a.id in (select tribuia.user_apartment_ids(v_uid))
    )
  ) then
    raise exception 'No tienes acceso a este condominio' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'pending_amount', coalesce(sum(f.amount) filter (where f.status = 'PENDING'), 0),
           'pending_count',  count(*) filter (where f.status = 'PENDING'),
           'paid_amount',    coalesce(sum(f.amount) filter (where f.status = 'PAID'), 0),
           'paid_count',     count(*) filter (where f.status = 'PAID'),
           'appealed_count', count(*) filter (where f.status = 'APPEALED'),
           'total_count',    count(*)
         )
    into v_result
    from tribuia.fines f
   where f.condominium_id = p_condominium
     and (v_all or f.apartment_id in (select tribuia.user_apartment_ids(v_uid)))
     and (p_status is null or f.status::text = p_status)
     and (p_apartment is null or f.apartment_id = p_apartment)
     and (p_from is null or f.fine_date >= p_from)
     and (p_to is null or f.fine_date <= p_to)
     and (v_pattern is null
          or f.reason ilike v_pattern
          or f.description ilike v_pattern
          or f.notes ilike v_pattern);

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Resumen de cuotas de administracion (solo administracion)
-- ----------------------------------------------------------------------------
-- Vencida = PENDING con due_date anterior a hoy (hora de Colombia, igual que el
-- navegador del usuario). pending_* incluye las vencidas.
create or replace function tribuia.admin_fees_summary(
  p_condominium uuid,
  p_status      text default null,
  p_from        date default null,
  p_to          date default null,
  p_search      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_today   date := (now() at time zone 'America/Bogota')::date;
  v_pattern text := tribuia.list_search_pattern(p_search);
  v_result  jsonb;
begin
  if not tribuia.is_condominium_admin(p_condominium, (select auth.uid())) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'paid_amount',    coalesce(sum(f.amount) filter (where f.status = 'PAID'), 0),
           'paid_count',     count(*) filter (where f.status = 'PAID'),
           'pending_amount', coalesce(sum(f.amount) filter (where f.status = 'PENDING'), 0),
           'pending_count',  count(*) filter (where f.status = 'PENDING'),
           'overdue_count',  count(*) filter (where f.status = 'PENDING' and f.due_date < v_today),
           'overdue_amount', coalesce(sum(f.amount) filter (where f.status = 'PENDING' and f.due_date < v_today), 0)
         )
    into v_result
    from tribuia.admin_fees f
   where f.condominium_id = p_condominium
     and (p_status is null or f.status::text = p_status)
     and (p_from is null or f.due_date >= p_from)
     and (p_to is null or f.due_date <= p_to)
     and (v_pattern is null or f.notes ilike v_pattern);

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Resumen de gastos
-- ----------------------------------------------------------------------------
-- Acceso igual a la politica expenses_select (can_view_finance).
-- total_amount suma todas las filas filtradas (cualquier estado).
create or replace function tribuia.expenses_summary(
  p_condominium uuid,
  p_status      text default null,
  p_category    uuid default null,
  p_from        date default null,
  p_to          date default null,
  p_search      text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_pattern text := tribuia.list_search_pattern(p_search);
  v_result  jsonb;
begin
  if not tribuia.can_view_finance(p_condominium, (select auth.uid())) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'total_amount',   coalesce(sum(e.amount), 0),
           'pending_amount', coalesce(sum(e.amount) filter (where e.status = 'PENDING'), 0),
           'count',          count(*)
         )
    into v_result
    from tribuia.expenses e
   where e.condominium_id = p_condominium
     and (p_status is null or e.status::text = p_status)
     and (p_category is null or e.category_id = p_category)
     and (p_from is null or e.expense_date >= p_from)
     and (p_to is null or e.expense_date <= p_to)
     and (v_pattern is null
          or e.concept ilike v_pattern
          or e.provider ilike v_pattern
          or e.invoice_number ilike v_pattern
          or e.description ilike v_pattern);

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Panel de plataforma (solo SUPER_ADMIN)
-- ----------------------------------------------------------------------------
-- plan: ultimo periodo pagado (mayor ends_at); activo si ends_at >= hoy, igual
-- que PlansPage. last_payment_at: ultimo pago APROBADO del conjunto (cuotas,
-- multas o plan). Agregados con GROUP BY (sin subconsultas por fila).
create or replace function tribuia.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_today  date := (now() at time zone 'America/Bogota')::date;
  v_result jsonb;
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede ver el panel de plataforma'
      using errcode = '42501';
  end if;

  with
  apts as (
    select a.condominium_id, count(*) as n
      from tribuia.apartments a
     group by a.condominium_id
  ),
  mem as (
    select m.condominium_id, count(distinct m.user_id) as n
      from tribuia.condominium_members m
     where m.status = 'ACTIVE'
     group by m.condominium_id
  ),
  own as (
    select a.condominium_id, count(distinct o.profile_id) as n
      from tribuia.apartment_owners o
      join tribuia.apartments a on a.id = o.apartment_id
     where o.is_active
     group by a.condominium_id
  ),
  adm as (
    select x.condominium_id,
           jsonb_agg(jsonb_build_object('full_name', x.full_name, 'email', x.email)
                     order by x.full_name, x.email) as list
      from (
        select distinct m.condominium_id, p.full_name, p.email
          from tribuia.condominium_members m
          join tribuia.roles r on r.id = m.role_id
          join tribuia.profiles p on p.id = m.user_id
         where m.status = 'ACTIVE' and r.code = 'ADMINISTRATOR'
      ) x
     group by x.condominium_id
  ),
  sub as (
    select distinct on (s.condominium_id)
           s.condominium_id, s.plan_period, s.ends_at
      from tribuia.subscriptions s
     order by s.condominium_id, s.ends_at desc, s.created_at desc
  ),
  pay as (
    select p.condominium_id, max(p.paid_at) as last_paid
      from tribuia.payments p
     where p.status = 'APPROVED'
     group by p.condominium_id
  ),
  cr as (
    select c.id, c.name, c.city, c.status, c.created_at,
           coalesce(apts.n, 0) as apartments,
           coalesce(mem.n, 0)  as members,
           coalesce(own.n, 0)  as owners,
           coalesce(adm.list, '[]'::jsonb) as admins,
           sub.plan_period, sub.ends_at,
           (sub.ends_at is not null and sub.ends_at >= v_today) as plan_active,
           pay.last_paid
      from tribuia.condominiums c
      left join apts on apts.condominium_id = c.id
      left join mem  on mem.condominium_id  = c.id
      left join own  on own.condominium_id  = c.id
      left join adm  on adm.condominium_id  = c.id
      left join sub  on sub.condominium_id  = c.id
      left join pay  on pay.condominium_id  = c.id
  )
  select jsonb_build_object(
           'totals', jsonb_build_object(
             'condominiums',         (select count(*) from cr),
             'active_condominiums',  (select count(*) from cr where status = 'ACTIVE'),
             'apartments',           (select count(*) from tribuia.apartments),
             'users',                (select count(*) from tribuia.profiles),
             'active_subscriptions', (select count(*) from cr where plan_active),
             'expired_or_none',      (select count(*) from cr where not plan_active)
           ),
           'condominiums', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id',         r.id,
                      'name',       r.name,
                      'city',       r.city,
                      'status',     r.status,
                      'created_at', r.created_at,
                      'apartments', r.apartments,
                      'members',    r.members,
                      'owners',     r.owners,
                      'admins',     r.admins,
                      'plan',       case when r.ends_at is null then null else jsonb_build_object(
                                      'period',  r.plan_period,
                                      'ends_at', r.ends_at,
                                      'active',  r.plan_active) end,
                      'last_payment_at', r.last_paid
                    ) order by r.name, r.id)
               from cr r
           ), '[]'::jsonb)
         )
    into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Permisos: solo usuarios autenticados (el esquema concede a anon por defecto)
-- ----------------------------------------------------------------------------
revoke execute on function tribuia.fines_summary(uuid, text, uuid, date, date, text) from public, anon;
revoke execute on function tribuia.admin_fees_summary(uuid, text, date, date, text) from public, anon;
revoke execute on function tribuia.expenses_summary(uuid, text, uuid, date, date, text) from public, anon;
revoke execute on function tribuia.platform_overview() from public, anon;
grant execute on function tribuia.fines_summary(uuid, text, uuid, date, date, text) to authenticated;
grant execute on function tribuia.admin_fees_summary(uuid, text, date, date, text) to authenticated;
grant execute on function tribuia.expenses_summary(uuid, text, uuid, date, date, text) to authenticated;
grant execute on function tribuia.platform_overview() to authenticated;

notify pgrst, 'reload schema';
