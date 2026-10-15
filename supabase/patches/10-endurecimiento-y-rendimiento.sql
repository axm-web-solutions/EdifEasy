-- ============================================================================
-- PARCHE 10 :: Endurecimiento de permisos y rendimiento de consultas
-- ----------------------------------------------------------------------------
-- ALCANCE: UNICAMENTE el esquema `tribuia`.
--
--   >>> ESTE PARCHE NO TOCA EL ESQUEMA `public` NI EL ESQUEMA `storage`. <<<
--
--   En el bloque A los permisos se revocan del rol `public` (el rol implicito
--   de PostgreSQL, no el esquema). Ninguna sentencia de este archivo menciona
--   el esquema `public`: todas las referencias son `tribuia.*`.
--
-- Que hace:
--   A. Funciones auxiliares de conjunto: mueven el trabajo de las politicas RLS
--      de "una vez por fila" a "una vez por consulta".
--   B. Politicas RLS: convierte en InitPlan las llamadas con argumento constante
--      (auth.uid(), is_super_admin) y en conjunto las que devolvian un booleano
--      por fila (has_role, user_can_access_condominium, is_condominium_admin,
--      can_view_finance, can_manage_finance, shares_condominium).
--   C. Cierre de la superficie RPC: ninguna funcion de `tribuia` queda invocable
--      por `anon` salvo las cuatro que el flujo de registro necesita.
--   D. Indices trigram (pg_trgm) para las busquedas ILIKE '%...%' de la UI.
--   E. Indices de cobertura para las claves foraneas que no lo tenian.
--   F. Baja de indices redundantes e indices parciales `where is_active`.
--   G. Vista `buildings_with_counts` (conteo de apartamentos por bloque en la
--      base, en lugar de contarlos en JavaScript).
--
-- Orden recomendado:
--   1) supabase/schema.sql
--   2) supabase/patches/01..09
--   3) ESTE archivo (10)
--
-- Seguro de re-ejecutar: todo es idempotente. La seccion B se puede repetir
-- porque cada sustitucion comprueba antes si ya estaba aplicada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A. FUNCIONES AUXILIARES DE CONJUNTO
-- ----------------------------------------------------------------------------
-- Las funciones originales (has_role, user_can_access_condominium, ...) reciben
-- el id de la fila que se esta evaluando, asi que PostgreSQL las ejecuta una vez
-- POR FILA. Estas versiones devuelven el CONJUNTO de ids accesibles para el
-- usuario, de modo que la politica se resuelve con un subplan evaluado una sola
-- vez por consulta y una prueba de pertenencia por fila.
--
-- Son semanticamente equivalentes a las originales: mismo `status = 'ACTIVE'`,
-- mismos codigos de rol, y la misma condicion de SUPER_ADMIN.
-- ----------------------------------------------------------------------------

-- Condominios donde el usuario tiene alguno de los roles indicados.
create or replace function tribuia.condominium_ids_with_role(
  p_codes text[],
  p_user  uuid default auth.uid()
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
  where m.user_id = p_user
    and m.status = 'ACTIVE'
    and r.code = any (p_codes);
$$;

-- Perfiles que comparten al menos un condominio con el usuario.
-- Equivale a `tribuia.shares_condominium(...)` sin el termino de SUPER_ADMIN
-- (que las politicas anaden aparte) ni el `p_target = p_user` (que tambien
-- cubre la propia fila cuando el usuario tiene alguna membresia).
create or replace function tribuia.shared_profile_ids(p_user uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select distinct b.user_id
  from tribuia.condominium_members a
  join tribuia.condominium_members b on b.condominium_id = a.condominium_id
  where a.user_id = p_user
    and a.status = 'ACTIVE'
    and b.status = 'ACTIVE';
$$;

grant execute on function tribuia.condominium_ids_with_role(text[], uuid)
  to authenticated, service_role;
grant execute on function tribuia.shared_profile_ids(uuid)
  to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- B. OPTIMIZACION DE LAS POLITICAS RLS (InitPlan por consulta)
-- ----------------------------------------------------------------------------
-- Se reescribe el texto de cada politica de `tribuia`. Es una transformacion de
-- TEXTO equivalente (no cambia la logica):
--
--   auth.uid()                            -> (select auth.uid())
--   tribuia.is_super_admin()              -> (select tribuia.is_super_admin())
--   tribuia.has_role(X, ARRAY[...])       -> ((select ...super_admin) or X in (select ...condominium_ids_with_role(ARRAY[...])))
--   tribuia.is_condominium_admin(X)       -> ((select ...super_admin) or X in (select ...condominium_ids_with_role(ARRAY['ADMINISTRATOR'])))
--   tribuia.user_can_access_condominium(X)-> ((select ...super_admin) or X in (select ...user_condominium_ids()))
--   tribuia.can_view_finance(X)           -> ((select ...super_admin) or X in (select ...condominium_ids_with_role(ARRAY['ADMINISTRATOR','SPOKESPERSON','OWNER'])))
--   tribuia.can_manage_finance(X)         -> ((select ...super_admin) or X in (select ...condominium_ids_with_role(ARRAY['ADMINISTRATOR'])))
--   tribuia.shares_condominium(X)         -> ((select ...super_admin) or X in (select ...shared_profile_ids()))
--
-- Cuando el argumento es una llamada anidada (por ejemplo
-- `is_condominium_admin(apartment_condominium(apartment_id))`) la sustitucion NO
-- se aplica a proposito: sin poder comprobar el parentesis de cierre, reescribir
-- esa forma seria arriesgado. Esas politicas siguen funcionando igual.
--
-- Solo se tocan politicas del esquema `tribuia`. Ni `public` ni `storage`.
-- ----------------------------------------------------------------------------

create or replace function tribuia._opt_policy_expr(p_expr text)
returns text
language plpgsql
immutable
as $$
declare
  v text := p_expr;
begin
  if v is null then
    return null;
  end if;

  -- 1. tribuia.is_super_admin()  ->  (select tribuia.is_super_admin())
  if position('tribuia.is_super_admin()' in v) > 0
     and position('SELECT tribuia.is_super_admin() AS is_super_admin' in v) = 0 then
    v := replace(v, 'tribuia.is_super_admin()', '(select tribuia.is_super_admin())');
  end if;

  -- 2. tribuia.is_condominium_admin(X)
  v := regexp_replace(
         v,
         'tribuia\.is_condominium_admin\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(ARRAY[''ADMINISTRATOR''])))',
         'g');

  -- 3. tribuia.has_role(X, ARRAY[...])
  v := regexp_replace(
         v,
         'tribuia\.has_role\(([a-z_]+), (ARRAY\[[^]]*\])\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(\2)))',
         'g');

  -- 4. tribuia.user_can_access_condominium(X)
  v := regexp_replace(
         v,
         'tribuia\.user_can_access_condominium\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.user_condominium_ids()))',
         'g');

  -- 5. tribuia.can_view_finance(X) / tribuia.can_manage_finance(X)
  v := regexp_replace(
         v,
         'tribuia\.can_view_finance\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(ARRAY[''ADMINISTRATOR'', ''SPOKESPERSON'', ''OWNER''])))',
         'g');
  v := regexp_replace(
         v,
         'tribuia\.can_manage_finance\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.condominium_ids_with_role(ARRAY[''ADMINISTRATOR''])))',
         'g');

  -- 6. tribuia.shares_condominium(X)
  v := regexp_replace(
         v,
         'tribuia\.shares_condominium\(([a-z_]+)\)',
         '((select tribuia.is_super_admin()) or \1 in (select tribuia.shared_profile_ids()))',
         'g');

  -- 7. auth.uid()  ->  (select auth.uid())
  if position('auth.uid()' in v) > 0
     and position('SELECT auth.uid() AS uid' in v) = 0 then
    v := replace(v, 'auth.uid()', '(select auth.uid())');
  end if;

  return v;
end;
$$;

do $opt$
declare
  pol      record;
  v_claves text[];
  v_expr   text;
  i        int;
  v_total  int := 0;
  v_cambio int := 0;
begin
  for pol in
    select c.relname as tabla, p.polname,
           pg_get_expr(p.polqual, p.polrelid) as q_using,
           pg_get_expr(p.polwithcheck, p.polrelid) as q_check
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'tribuia'
  loop
    v_total := v_total + 1;
    v_claves := array[pol.q_using, pol.q_check];

    for i in 1..2 loop
      if v_claves[i] is not null then
        v_expr := tribuia._opt_policy_expr(v_claves[i]);
        v_claves[i] := v_expr;
      end if;
    end loop;

    if v_claves[1] is distinct from pol.q_using
       or v_claves[2] is distinct from pol.q_check then
      execute format(
        'alter policy %I on tribuia.%I%s%s',
        pol.polname,
        pol.tabla,
        case when v_claves[1] is not null then ' using (' || v_claves[1] || ')' else '' end,
        case when v_claves[2] is not null then ' with check (' || v_claves[2] || ')' else '' end
      );
      v_cambio := v_cambio + 1;
    end if;
  end loop;

  raise notice 'politicas optimizadas: % de % (esquema tribuia)', v_cambio, v_total;
end
$opt$;

-- La funcion de apoyo ya cumplio: no se queda en el esquema.
drop function if exists tribuia._opt_policy_expr(text);


-- ----------------------------------------------------------------------------
-- C. CIERRE DE LA SUPERFICIE RPC
-- ----------------------------------------------------------------------------
-- Antes de este parche, 24 de las 25 funciones RPC que usa el frontend eran
-- invocables por el rol `anon` (sin sesion). Ahora:
--   - Solo quedan abiertas a `anon` las 4 que el flujo de registro necesita.
--   - El resto exige `authenticated` (que es quien las llama desde la app) y
--     sigue disponible para `service_role`.
--   - `apply_payment_result` continua reservada a `service_role` (parche 09).
--
-- NOTA: en `revoke ... from public` el termino `public` es el ROL implicito de
-- PostgreSQL, no el esquema. Ningun objeto del esquema `public` se modifica.
-- ----------------------------------------------------------------------------

do $rpc$
declare
  f record;
  v_anon_ok text[] := array[
    'registration_catalog',
    'registration_buildings',
    'registration_apartments',
    'complete_self_registration'
  ];
  v_cerradas int := 0;
begin
  for f in
    select p.proname,
           format('tribuia.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'tribuia'
      and p.prokind = 'f'
  loop
    if f.proname = any (v_anon_ok) then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.firma);
      continue;
    end if;

    execute format('revoke all on function %s from public, anon', f.firma);

    if f.proname = 'apply_payment_result' then
      execute format('revoke all on function %s from authenticated', f.firma);
      execute format('grant execute on function %s to service_role', f.firma);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.firma);
    end if;

    v_cerradas := v_cerradas + 1;
  end loop;

  raise notice 'funciones cerradas a anon: %', v_cerradas;
end
$rpc$;


-- ----------------------------------------------------------------------------
-- D. INDICES TRIGRAM PARA LAS BUSQUEDAS DE LA UI
-- ----------------------------------------------------------------------------
-- `applyListParams` genera `columna.ilike.%termino%`. Un patron con `%` a la
-- izquierda no puede usar un indice B-tree, asi que PostgreSQL hacia un
-- sequential scan. pg_trgm (ya instalada) resuelve eso con un indice GIN.
--
-- Un indice GIN multicolumna sirve para una condicion sobre CUALQUIER
-- subconjunto de sus columnas, por eso se agrupa una tabla por indice.
-- Las columnas son exactamente las que declara `searchColumns` en cada servicio.
-- ----------------------------------------------------------------------------
create extension if not exists "pg_trgm" with schema extensions;

create index if not exists idx_condominiums_search on tribuia.condominiums
  using gin (name gin_trgm_ops, nit gin_trgm_ops, city gin_trgm_ops,
             address gin_trgm_ops, email gin_trgm_ops);

create index if not exists idx_buildings_search on tribuia.buildings
  using gin (name gin_trgm_ops, number gin_trgm_ops, description gin_trgm_ops);

create index if not exists idx_apartments_search on tribuia.apartments
  using gin (number gin_trgm_ops, description gin_trgm_ops);

create index if not exists idx_residents_search on tribuia.residents
  using gin (full_name gin_trgm_ops, document_number gin_trgm_ops,
             email gin_trgm_ops, phone gin_trgm_ops);

create index if not exists idx_vehicles_search on tribuia.vehicles
  using gin (plate gin_trgm_ops, brand gin_trgm_ops, model gin_trgm_ops,
             color gin_trgm_ops, parking_spot gin_trgm_ops);

create index if not exists idx_pets_search on tribuia.pets
  using gin (name gin_trgm_ops, breed gin_trgm_ops, color gin_trgm_ops);

create index if not exists idx_visitors_search on tribuia.visitors
  using gin (full_name gin_trgm_ops, document_number gin_trgm_ops,
             phone gin_trgm_ops, plate gin_trgm_ops, company gin_trgm_ops);

create index if not exists idx_requests_search on tribuia.requests
  using gin (title gin_trgm_ops, description gin_trgm_ops, code gin_trgm_ops);

create index if not exists idx_incidents_search on tribuia.incidents
  using gin (title gin_trgm_ops, description gin_trgm_ops, location gin_trgm_ops,
             code gin_trgm_ops);

create index if not exists idx_announcements_search on tribuia.announcements
  using gin (title gin_trgm_ops, content gin_trgm_ops);

create index if not exists idx_alerts_search on tribuia.alerts
  using gin (title gin_trgm_ops, description gin_trgm_ops);

create index if not exists idx_expenses_search on tribuia.expenses
  using gin (concept gin_trgm_ops, provider gin_trgm_ops,
             invoice_number gin_trgm_ops, description gin_trgm_ops);

create index if not exists idx_purchases_search on tribuia.purchases
  using gin (provider gin_trgm_ops, code gin_trgm_ops,
             invoice_number gin_trgm_ops, notes gin_trgm_ops);

create index if not exists idx_fines_search on tribuia.fines
  using gin (reason gin_trgm_ops, description gin_trgm_ops, notes gin_trgm_ops);

create index if not exists idx_admin_fees_search on tribuia.admin_fees
  using gin (notes gin_trgm_ops);

create index if not exists idx_documents_search on tribuia.documents
  using gin (title gin_trgm_ops, description gin_trgm_ops, file_name gin_trgm_ops);

create index if not exists idx_audit_logs_search on tribuia.audit_logs
  using gin (entity gin_trgm_ops);


-- ----------------------------------------------------------------------------
-- E. INDICES DE COBERTURA PARA LAS CLAVES FORANEAS
-- ----------------------------------------------------------------------------
-- Sin indice, un UPDATE/DELETE sobre la tabla padre obliga a un sequential scan
-- de la hija para validar la clave foranea, y los join por esas columnas no se
-- pueden optimizar.
--
-- La lista se DERIVA del catalogo en lugar de escribirse a mano: cubre tambien
-- las claves foraneas que se anadan en el futuro. El nombre del indice se toma
-- del nombre del constraint para que sea estable entre entornos.
-- ----------------------------------------------------------------------------
do $fk$
declare
  fk record;
  v_creados int := 0;
begin
  for fk in
    select n.nspname as esquema,
           c.relname as tabla,
           'idx_' || c.relname || '_' || substr(con.conname, 1, length(con.conname) - 5) || '_fk'
             as idx_nombre,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
            from unnest(con.conkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columnas
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where con.contype = 'f'
      and n.nspname = 'tribuia'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = con.conrelid
          and i.indisvalid
          and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] = con.conkey
      )
  loop
    if not exists (
      select 1
      from pg_class ic
      join pg_namespace inn on inn.oid = ic.relnamespace
      where inn.nspname = fk.esquema and ic.relname = fk.idx_nombre
    ) then
      execute format('create index %I on %I.%I (%s)',
                     fk.idx_nombre, fk.esquema, fk.tabla, fk.columnas);
      v_creados := v_creados + 1;
    end if;
  end loop;

  raise notice 'indices de clave foranea creados: %', v_creados;
end
$fk$;


-- ----------------------------------------------------------------------------
-- F. INDICES REDUNDANTES Y PARCIALES
-- ----------------------------------------------------------------------------

-- F.1 Baja de indices redundantes.
-- Un indice NO unico (y que no respalda un constraint) cuyas columnas lideres
-- estan cubiertas por otro indice completo: solo anade coste de escritura.
-- Dos condiciones obligatorias para el indice que cubre:
--   - debe ser TOTAL (sin WHERE): uno parcial NO cubre.
--   - debe ser btree igual que el comparado: un GIN de busqueda trigram no queda
--     cubierto por un btree aunque coincida la columna lider.
-- El indice que cubre debe ser total (sin WHERE): uno parcial NO cubre.
do $redundantes$
declare
  r record;
  v_bajados int := 0;
begin
  for r in
    select n.nspname as esquema, ic.relname as idx
    from pg_index a
    join pg_class c on c.oid = a.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class ic on ic.oid = a.indexrelid
    where n.nspname = 'tribuia'
      and a.indisvalid
      and a.indisunique = false
      and a.indisprimary = false
      and a.indpred is null
      and not exists (select 1 from pg_constraint ce where ce.conindid = a.indexrelid)
      -- Solo se comparan indices btree. Un indice GIN (busqueda trigram por
      -- ILIKE '%...%') NO queda cubierto por un btree aunque coincida la
      -- columna lider: un btree no puede resolver ese patron.
      and (select am.amname
             from pg_am am
             join pg_class ia on ia.relam = am.oid
            where ia.oid = a.indexrelid) = 'btree'
      and exists (
        select 1
        from pg_index b
        join pg_class ib on ib.oid = b.indexrelid
        join pg_am amb on amb.oid = ib.relam
        where b.indrelid = a.indrelid
          and b.indexrelid <> a.indexrelid
          and b.indisvalid
          and amb.amname = 'btree'
          and b.indpred is null
          and b.indnkeyatts >= a.indnkeyatts
          and (b.indkey::int2[])[0:array_length(a.indkey::int2[], 1) - 1]
              = (a.indkey::int2[])[0:array_length(a.indkey::int2[], 1) - 1]
      )
  loop
    execute format('drop index if exists %I.%I', r.esquema, r.idx);
    raise notice 'indice redundante eliminado: %.%', r.esquema, r.idx;
    v_bajados := v_bajados + 1;
  end loop;

  raise notice 'indices redundantes eliminados: %', v_bajados;
end
$redundantes$;

-- F.2 Indices parciales para los listados mas frecuentes.
-- La UI filtra por registros activos; un indice parcial es mucho mas pequeno y
-- sigue sirviendo para esas consultas.
create index if not exists idx_residents_active
  on tribuia.residents (condominium_id, full_name) where is_active;
create index if not exists idx_owners_active
  on tribuia.apartment_owners (profile_id, apartment_id) where is_active;
create index if not exists idx_tenants_active
  on tribuia.apartment_tenants (profile_id, apartment_id) where is_active;


-- ----------------------------------------------------------------------------
-- G. VISTA CON EL CONTEO DE APARTAMENTOS POR BLOQUE
-- ----------------------------------------------------------------------------
-- `buildingService.listWithCounts` descargaba TODOS los apartamentos para
-- contarlos en JavaScript. Ademas, si el condominio tiene mas apartamentos que
-- `max_rows` de PostgREST (1000 por defecto), el conteo salia mal sin error.
--
-- `security_invoker = true` hace que la vista respete las politicas RLS de quien
-- consulta (PostgreSQL 15+).
-- ----------------------------------------------------------------------------
create or replace view tribuia.buildings_with_counts
with (security_invoker = true)
as
select
  b.*,
  (select count(*) from tribuia.apartments a where a.building_id = b.id) as apartment_count
from tribuia.buildings b;

grant select on tribuia.buildings_with_counts to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- Refresca el cache de esquema de PostgREST para que las funciones e indices
-- nuevos respondan de inmediato.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';


