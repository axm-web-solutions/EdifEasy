-- ============================================================================
-- Modulos por rol (matriz modulos x roles por conjunto)
-- ----------------------------------------------------------------------------
-- El SUPER_ADMIN decide, por conjunto, que modulos ve y puede usar cada rol.
--
--   A. Tabla `role_modules`: una fila por (conjunto, rol, modulo) con `enabled`.
--      condominium_id null = PLANTILLA por defecto, aplica a los conjuntos sin
--      fila propia. Resolucion por rol:
--        enabled = coalesce(fila del conjunto, fila de la plantilla, true)
--      SIN FILAS = TODO HABILITADO: esta migracion no cambia lo que ve nadie
--      hasta que alguien desactive un modulo.
--   B. `module_enabled(condominio, modulo, usuario)` (RPC y resumenes) y su
--      version de conjunto `module_blocked_condominiums` (politicas RLS).
--      Habilitado si es SUPER_ADMIN, si no tiene membresia activa en el conjunto
--      (decide la politica existente) o si ALGUNO de sus roles tiene el modulo
--      habilitado.
--   C. RPC: my_disabled_modules, role_modules_matrix, set_role_module,
--      reset_role_modules (las tres ultimas solo SUPER_ADMIN).
--   D. ENFORCEMENT: TODAS las politicas (select / insert / update / delete) de
--      las tablas de cada modulo agregan con AND
--        <condominio> not in (select tribuia.module_blocked_condominiums('<modulo>'))
--      que es equivalente a `tribuia.module_enabled(<condominio>, '<modulo>')`
--      (probado celda a celda) pero se evalua una vez por consulta. Solo se
--      agrega una condicion con AND: nada se debilita.
--   E. fines_summary, admin_fees_summary, expenses_summary y generate_admin_fees
--      responden 42501 si el modulo esta deshabilitado para quien llama.
--
-- Funciones de servicio: `apply_payment_result` y los triggers son SECURITY
-- DEFINER (el propietario no esta sujeto a RLS) y la service role tiene
-- BYPASSRLS; ademas, con auth.uid() null module_enabled devuelve true y
-- module_blocked_condominiums no devuelve nada. El flujo de pagos no se bloquea.
--
-- RENDIMIENTO
--   * module_enabled(condominio, ...) por fila costaba ~20 us/fila en PGlite
--     (count(*) de 20.000 multas: 9 ms -> 420 ms sin filas OFF y 1.550 ms con
--     filas OFF). Como la app pide count=exact en todos los listados, ese costo
--     se pagaba sobre TODAS las filas del conjunto en cada pagina.
--   * Por eso las politicas usan la version de conjunto: un subplan hasheado
--     por consulta (membresias del usuario: indice unique (condominium_id,
--     user_id, role_id) + idx de user_id; role_modules: indice unico
--     (condominium_id, role_code, module)) y por fila una prueba en el hash.
--   * Puerta global: si no existe NINGUNA fila `enabled = false` del modulo
--     (indice parcial idx_role_modules_disabled, vacio en el caso normal) el
--     subplan termina sin leer membresias.
--   * module_enabled se mantiene (contrato) para RPC y resumenes: una llamada.
--
-- Idempotente. Requiere 20261016000000_endurecimiento_y_rendimiento.sql.
-- Reflejada en supabase/schema.sql (3.28, 4, 5.12, 7.x en su sitio, 15, el
-- bloque de pagos y la seccion 17).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A. TABLA role_modules
-- ----------------------------------------------------------------------------
create table if not exists tribuia.role_modules (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid references tribuia.condominiums (id) on delete cascade,
  role_code      text not null,
  module         text not null,
  enabled        boolean not null,
  updated_by     uuid references tribuia.profiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  constraint role_modules_scope_key unique nulls not distinct (condominium_id, role_code, module),
  constraint role_modules_role_code_check check (role_code in (
    'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT', 'SECURITY', 'SERVICE_STAFF'
  )),
  constraint role_modules_module_check check (module in (
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports'
  ))
);

comment on table tribuia.role_modules is
  'Modulos habilitados por rol. condominium_id null = plantilla por defecto. Sin fila = habilitado. Solo se escribe via set_role_module / reset_role_modules.';

-- El indice unico (condominium_id, role_code, module) resuelve las busquedas por
-- conjunto y por plantilla (condominium_id is null usa el mismo indice) y cubre
-- la FK de condominium_id.
-- Ruta rapida de module_enabled: solo indexa las filas deshabilitadas.
create index if not exists idx_role_modules_disabled
  on tribuia.role_modules (module, condominium_id) where not enabled;
-- FK updated_by (on delete set null).
create index if not exists idx_role_modules_updated_by
  on tribuia.role_modules (updated_by);

drop trigger if exists trg_role_modules_updated_at on tribuia.role_modules;
create trigger trg_role_modules_updated_at before update on tribuia.role_modules
  for each row execute function tribuia.set_updated_at();


-- ----------------------------------------------------------------------------
-- B. CATALOGOS Y module_enabled
-- ----------------------------------------------------------------------------
-- Orden de presentacion de la matriz. Deben coincidir con los checks de la tabla.
create or replace function tribuia.role_module_roles()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT', 'SECURITY', 'SERVICE_STAFF']::text[];
$$;

create or replace function tribuia.role_module_codes()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array[
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports'
  ]::text[];
$$;

create or replace function tribuia.module_enabled(
  p_condominium uuid,
  p_module      text,
  p_user        uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_enabled boolean;
begin
  -- Ruta rapida: sin conjunto, sin usuario (service role) o sin ninguna fila
  -- deshabilitada para el modulo (ni en el conjunto ni en la plantilla).
  if p_condominium is null
     or p_user is null
     or not exists (
       select 1
         from tribuia.role_modules rm
        where rm.module = p_module
          and not rm.enabled
          and (rm.condominium_id = p_condominium or rm.condominium_id is null)
     ) then
    return true;
  end if;

  if tribuia.is_super_admin(p_user) then
    return true;
  end if;

  -- Basta con que UNO de sus roles activos en el conjunto lo tenga habilitado.
  -- Sin membresias activas bool_or da null -> true (decide la politica).
  select bool_or(coalesce(rc.enabled, rt.enabled, true))
    into v_enabled
    from tribuia.condominium_members m
    join tribuia.roles r on r.id = m.role_id
    left join tribuia.role_modules rc
           on rc.condominium_id = p_condominium
          and rc.role_code = r.code
          and rc.module = p_module
    left join tribuia.role_modules rt
           on rt.condominium_id is null
          and rt.role_code = r.code
          and rt.module = p_module
   where m.condominium_id = p_condominium
     and m.user_id = p_user
     and m.status = 'ACTIVE';

  return coalesce(v_enabled, true);
end;
$$;


-- Version de conjunto de module_enabled para las politicas RLS: condominios
-- donde el modulo esta BLOQUEADO para el usuario (tiene membresias activas y
-- ninguno de sus roles lo tiene habilitado). Para cualquier condominio c:
--   module_enabled(c, m, u)  <=>  c not in (select module_blocked_condominiums(m, u))
-- Las politicas usan `<condominio> not in (select ...)`: PostgreSQL la resuelve
-- como subplan hasheado UNA vez por consulta y por fila solo hace una prueba de
-- pertenencia. Llamar a module_enabled por fila multiplicaba por ~40 el costo de
-- un count(*) (count=exact de PostgREST) sobre todo el conjunto.
-- Sin filas deshabilitadas para el modulo, SUPER_ADMIN o usuario null: vacio.
create or replace function tribuia.module_blocked_condominiums(
  p_module text,
  p_user   uuid default auth.uid()
)
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select m.condominium_id
    from tribuia.condominium_members m
    join tribuia.roles r on r.id = m.role_id
    left join tribuia.role_modules rc
           on rc.condominium_id = m.condominium_id
          and rc.role_code = r.code
          and rc.module = p_module
    left join tribuia.role_modules rt
           on rt.condominium_id is null
          and rt.role_code = r.code
          and rt.module = p_module
   where m.user_id = p_user
     and m.status = 'ACTIVE'
     and exists (select 1 from tribuia.role_modules d where d.module = p_module and not d.enabled)
     and not tribuia.is_super_admin(p_user)
   group by m.condominium_id
  having not bool_or(coalesce(rc.enabled, rt.enabled, true));
$$;


-- ----------------------------------------------------------------------------
-- C. RPC
-- ----------------------------------------------------------------------------
-- Modulos deshabilitados para el usuario actual en el conjunto (orden del
-- catalogo). SUPER_ADMIN o usuario sin membresia: arreglo vacio.
create or replace function tribuia.my_disabled_modules(p_condominium uuid)
returns text[]
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(
           array_agg(u.module order by u.ord)
             filter (where not tribuia.module_enabled(p_condominium, u.module, (select auth.uid()))),
           '{}'::text[])
    from unnest(tribuia.role_module_codes()) with ordinality as u(module, ord);
$$;

-- Matriz completa roles x modulos. p_condominium null = plantilla.
-- source: 'condominium' (fila del conjunto), 'default' (fila de la plantilla),
-- 'system' (sin fila: habilitado).
create or replace function tribuia.role_modules_matrix(p_condominium uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede configurar los modulos por rol'
      using errcode = '42501';
  end if;

  if p_condominium is not null
     and not exists (select 1 from tribuia.condominiums c where c.id = p_condominium) then
    raise exception 'El condominio % no existe', p_condominium using errcode = 'P0002';
  end if;

  select jsonb_build_object(
           'condominium_id', p_condominium,
           'cells', coalesce(jsonb_agg(
             jsonb_build_object(
               'role',    r.code,
               'module',  m.code,
               'enabled', coalesce(rc.enabled, rt.enabled, true),
               'source',  case
                            when rc.id is not null then 'condominium'
                            when rt.id is not null then 'default'
                            else 'system'
                          end
             ) order by r.ord, m.ord), '[]'::jsonb)
         )
    into v_result
    from unnest(tribuia.role_module_roles()) with ordinality as r(code, ord)
   cross join unnest(tribuia.role_module_codes()) with ordinality as m(code, ord)
    left join tribuia.role_modules rc
           on p_condominium is not null
          and rc.condominium_id = p_condominium
          and rc.role_code = r.code
          and rc.module = m.code
    left join tribuia.role_modules rt
           on rt.condominium_id is null
          and rt.role_code = r.code
          and rt.module = m.code;

  return v_result;
end;
$$;

-- Crea o actualiza una celda. p_condominium null = plantilla.
create or replace function tribuia.set_role_module(
  p_condominium uuid,
  p_role        text,
  p_module      text,
  p_enabled     boolean
)
returns void
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede configurar los modulos por rol'
      using errcode = '42501';
  end if;

  if p_role is null or not (p_role = any (tribuia.role_module_roles())) then
    raise exception 'Rol no configurable: %', coalesce(p_role, 'null') using errcode = '22023';
  end if;
  if p_module is null or not (p_module = any (tribuia.role_module_codes())) then
    raise exception 'Modulo desconocido: %', coalesce(p_module, 'null') using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'enabled no puede ser null' using errcode = '22023';
  end if;

  if p_condominium is not null
     and not exists (select 1 from tribuia.condominiums c where c.id = p_condominium) then
    raise exception 'El condominio % no existe', p_condominium using errcode = 'P0002';
  end if;

  insert into tribuia.role_modules (condominium_id, role_code, module, enabled, updated_by, updated_at)
  values (p_condominium, p_role, p_module, p_enabled, (select auth.uid()), now())
  on conflict on constraint role_modules_scope_key do update
     set enabled    = excluded.enabled,
         updated_by = excluded.updated_by,
         updated_at = now();
end;
$$;

-- Borra la configuracion propia del conjunto (vuelve a la plantilla).
-- p_condominium null borra la plantilla (vuelve a "todo habilitado").
create or replace function tribuia.reset_role_modules(p_condominium uuid)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  if not tribuia.is_super_admin((select auth.uid())) then
    raise exception 'Solo un super administrador puede configurar los modulos por rol'
      using errcode = '42501';
  end if;

  if p_condominium is null then
    delete from tribuia.role_modules where condominium_id is null;
  else
    delete from tribuia.role_modules where condominium_id = p_condominium;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- RLS de role_modules: lectura para SUPER_ADMIN y para miembros (filas de su
-- conjunto y la plantilla). Sin politicas de escritura: solo via RPC.
-- ----------------------------------------------------------------------------
alter table tribuia.role_modules enable row level security;

drop policy if exists role_modules_select on tribuia.role_modules;
create policy role_modules_select on tribuia.role_modules for select to authenticated
  using (
    (select tribuia.is_super_admin())
    or condominium_id in (select tribuia.user_condominium_ids())
    or (condominium_id is null and (select exists (select 1 from tribuia.user_condominium_ids())))
  );

revoke all on tribuia.role_modules from anon;
revoke insert, update, delete, truncate on tribuia.role_modules from authenticated;
grant select on tribuia.role_modules to authenticated;
grant all on tribuia.role_modules to service_role;


-- ----------------------------------------------------------------------------
-- D. ENFORCEMENT EN LAS POLITICAS DE CADA MODULO
-- ----------------------------------------------------------------------------
-- Agrega `and <condominio> not in (select tribuia.module_blocked_condominiums('<modulo>'))`
-- al USING y al WITH CHECK de TODAS las politicas de cada tabla, partiendo del
-- texto actual de la politica (no se reescribe ni se pierde ninguna condicion).
-- Idempotente: una expresion que ya tiene la condicion no se toca.
-- Tablas hijas sin condominium_id: el condominio sale del padre.
do $mod$
declare
  v_map text[] := array[
    -- tabla, modulo, expresion del condominio
    'residents',                 'residents',     'condominium_id',
    'vehicles',                  'residents',     'condominium_id',
    'pets',                      'residents',     'condominium_id',
    'visitors',                  'visitors',      'condominium_id',
    'alerts',                    'alerts',        'condominium_id',
    'announcements',             'announcements', 'condominium_id',
    'conversations',             'messages',      'condominium_id',
    'conversation_participants', 'messages',      'tribuia.conversation_condominium(conversation_id)',
    'messages',                  'messages',      'condominium_id',
    'requests',                  'requests',      'condominium_id',
    'request_comments',          'requests',      'tribuia.request_condominium(request_id)',
    'incidents',                 'incidents',     'condominium_id',
    'fines',                     'fines',         'condominium_id',
    'admin_fees',                'admin_fees',    'condominium_id',
    'expenses',                  'expenses',      'condominium_id',
    'expense_categories',        'expenses',      'condominium_id',
    'purchases',                 'purchases',     'condominium_id',
    'purchase_items',            'purchases',     'tribuia.purchase_condominium(purchase_id)',
    'documents',                 'documents',     'condominium_id',
    'document_categories',       'documents',     'condominium_id'
  ];
  i         int;
  v_table   text;
  v_clause  text;
  pol       record;
  v_using   text;
  v_check   text;
  v_changed int := 0;
begin
  for i in 0 .. (array_length(v_map, 1) / 3) - 1 loop
    v_table  := v_map[i * 3 + 1];
    v_clause := format('%s not in (select tribuia.module_blocked_condominiums(%L))',
                       v_map[i * 3 + 3], v_map[i * 3 + 2]);

    for pol in
      select p.polname,
             pg_get_expr(p.polqual, p.polrelid)      as q_using,
             pg_get_expr(p.polwithcheck, p.polrelid) as q_check
        from pg_policy p
       where p.polrelid = format('tribuia.%I', v_table)::regclass
    loop
      v_using := pol.q_using;
      v_check := pol.q_check;

      if v_using is not null and position('module_blocked_condominiums(' in v_using) = 0 then
        v_using := format('(%s) and %s', v_using, v_clause);
      end if;
      if v_check is not null and position('module_blocked_condominiums(' in v_check) = 0 then
        v_check := format('(%s) and %s', v_check, v_clause);
      end if;

      if v_using is distinct from pol.q_using or v_check is distinct from pol.q_check then
        execute format(
          'alter policy %I on tribuia.%I%s%s',
          pol.polname,
          v_table,
          case when v_using is not null then ' using (' || v_using || ')' else '' end,
          case when v_check is not null then ' with check (' || v_check || ')' else '' end
        );
        v_changed := v_changed + 1;
      end if;
    end loop;
  end loop;

  raise notice 'politicas con control de modulo agregado: %', v_changed;
end
$mod$;


-- ----------------------------------------------------------------------------
-- E. RESUMENES Y RPC DE MODULO
-- ----------------------------------------------------------------------------
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

  -- Modulos por rol (seccion 17).
  if not tribuia.module_enabled(p_condominium, 'fines', v_uid) then
    raise exception 'El modulo de multas no esta habilitado para tu rol' using errcode = '42501';
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

  -- Modulos por rol (seccion 17).
  if not tribuia.module_enabled(p_condominium, 'admin_fees', (select auth.uid())) then
    raise exception 'El modulo de cuotas de administracion no esta habilitado para tu rol'
      using errcode = '42501';
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

  -- Modulos por rol (seccion 17).
  if not tribuia.module_enabled(p_condominium, 'expenses', (select auth.uid())) then
    raise exception 'El modulo de gastos no esta habilitado para tu rol' using errcode = '42501';
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

-- generate_admin_fees es SECURITY DEFINER (no pasa por RLS): sin este control
-- un administrador con el modulo de cuotas deshabilitado podria seguir
-- generando cuotas por RPC.
create or replace function tribuia.generate_admin_fees(
  p_condominium uuid,
  p_period date,
  p_amount numeric,
  p_due_date date
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_count  integer;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;
  -- SECURITY DEFINER no pasa por RLS: control explicito de modulos por rol.
  if not tribuia.module_enabled(p_condominium, 'admin_fees') then
    raise exception 'El modulo de cuotas de administracion no esta habilitado para tu rol'
      using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El valor de la cuota debe ser mayor a cero';
  end if;
  if p_due_date < v_period then
    raise exception 'La fecha limite no puede ser anterior al mes que se cobra';
  end if;

  insert into tribuia.admin_fees (condominium_id, apartment_id, period, amount, due_date, created_by)
  select p_condominium, a.id, v_period, p_amount, p_due_date, auth.uid()
    from tribuia.apartments a
   where a.condominium_id = p_condominium
     and exists (
       select 1 from tribuia.apartment_owners o
        where o.apartment_id = a.id and o.is_active
     )
  on conflict (apartment_id, period) do nothing;

  get diagnostics v_count = row_count;

  update tribuia.condominiums
     set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('adminFeeAmount', p_amount)
   where id = p_condominium;

  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- Permisos: nada para anon (el esquema concede execute a anon por defecto).
-- ----------------------------------------------------------------------------
revoke all on function tribuia.role_module_roles() from public, anon;
revoke all on function tribuia.role_module_codes() from public, anon;
revoke all on function tribuia.module_enabled(uuid, text, uuid) from public, anon;
revoke all on function tribuia.module_blocked_condominiums(text, uuid) from public, anon;
revoke all on function tribuia.my_disabled_modules(uuid) from public, anon;
revoke all on function tribuia.role_modules_matrix(uuid) from public, anon;
revoke all on function tribuia.set_role_module(uuid, text, text, boolean) from public, anon;
revoke all on function tribuia.reset_role_modules(uuid) from public, anon;

grant execute on function tribuia.role_module_roles() to authenticated, service_role;
grant execute on function tribuia.role_module_codes() to authenticated, service_role;
-- authenticated: resumenes y frontend. service_role: la Edge Function de pagos
-- puede validarlo con p_user.
grant execute on function tribuia.module_enabled(uuid, text, uuid) to authenticated, service_role;
-- authenticated: lo evaluan las politicas RLS.
grant execute on function tribuia.module_blocked_condominiums(text, uuid) to authenticated, service_role;
grant execute on function tribuia.my_disabled_modules(uuid) to authenticated, service_role;
grant execute on function tribuia.role_modules_matrix(uuid) to authenticated, service_role;
grant execute on function tribuia.set_role_module(uuid, text, text, boolean) to authenticated, service_role;
grant execute on function tribuia.reset_role_modules(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
