-- ============================================================================
-- Ubicacion del condominio y lugares cercanos guardados en la base
-- ----------------------------------------------------------------------------
-- Antes, cada navegador consultaba OpenStreetMap (Nominatim + Overpass) en cada
-- visita al dashboard. A escala eso viola la politica de uso de Nominatim
-- (maximo 1 consulta por segundo para toda la aplicacion). Ahora:
--
--   * Las coordenadas del conjunto se guardan una vez en `condominiums`.
--   * Los lugares cercanos (radio de 2 km) se guardan en `condominium_places`
--     y se refrescan como maximo cada 7 dias, solo desde la sesion de un
--     administrador. Residentes y personal leen de la base.
--
-- El trafico hacia OpenStreetMap pasa a ser proporcional al numero de
-- conjuntos, no al de usuarios. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. COORDENADAS DEL CONDOMINIO
-- ----------------------------------------------------------------------------
alter table tribuia.condominiums add column if not exists latitude numeric(9, 6);
alter table tribuia.condominiums add column if not exists longitude numeric(9, 6);
-- Direccion tal como la resolvio el mapa.
alter table tribuia.condominiums add column if not exists location_label text;
-- true si no se encontro la direccion exacta y se uso la ciudad.
alter table tribuia.condominiums add column if not exists location_approximate boolean not null default false;
-- Texto de direccion que se geocodifico: si la direccion cambia, se vuelve a ubicar.
alter table tribuia.condominiums add column if not exists location_source text;
alter table tribuia.condominiums add column if not exists places_updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- B. LUGARES CERCANOS
-- ----------------------------------------------------------------------------
create table if not exists tribuia.condominium_places (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  osm_id          text not null,
  name            text not null,
  category        text not null,
  latitude        numeric(9, 6) not null,
  longitude       numeric(9, 6) not null,
  distance_m      integer not null,
  address         text,
  created_at      timestamptz not null default now(),
  unique (condominium_id, osm_id)
);

create index if not exists idx_condominium_places_condominium
  on tribuia.condominium_places (condominium_id, distance_m);

alter table tribuia.condominium_places enable row level security;

drop policy if exists condominium_places_select on tribuia.condominium_places;
create policy condominium_places_select on tribuia.condominium_places for select to authenticated
  using (tribuia.user_can_access_condominium(condominium_id));

-- Sin politicas de escritura: solo se escribe con `replace_condominium_location`.
grant select on tribuia.condominium_places to authenticated;
grant all on tribuia.condominium_places to service_role;

-- ----------------------------------------------------------------------------
-- C. GUARDAR UBICACION Y LUGARES (atomico)
-- ----------------------------------------------------------------------------
-- p_location: { latitude, longitude, label, approximate, source } o null si no
--             cambio la ubicacion (solo se refrescan los lugares).
-- p_places:   [{ osm_id, name, category, latitude, longitude, distance_m, address }]
create or replace function tribuia.replace_condominium_location(
  p_condominium uuid,
  p_location jsonb,
  p_places jsonb
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count integer;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'Solo la administracion del conjunto puede actualizar su ubicacion'
      using errcode = '42501';
  end if;

  if p_location is not null then
    update tribuia.condominiums
       set latitude = (p_location ->> 'latitude')::numeric,
           longitude = (p_location ->> 'longitude')::numeric,
           location_label = p_location ->> 'label',
           location_approximate = coalesce((p_location ->> 'approximate')::boolean, false),
           location_source = p_location ->> 'source'
     where id = p_condominium;
  end if;

  delete from tribuia.condominium_places where condominium_id = p_condominium;

  insert into tribuia.condominium_places
    (condominium_id, osm_id, name, category, latitude, longitude, distance_m, address)
  select p_condominium,
         p.osm_id, left(p.name, 200), p.category, p.latitude, p.longitude, p.distance_m,
         left(p.address, 300)
    from jsonb_to_recordset(coalesce(p_places, '[]'::jsonb)) as p(
      osm_id text, name text, category text, latitude numeric, longitude numeric,
      distance_m integer, address text
    )
   where p.osm_id is not null and p.name is not null
  on conflict (condominium_id, osm_id) do nothing;

  get diagnostics v_count = row_count;

  update tribuia.condominiums set places_updated_at = now() where id = p_condominium;

  return v_count;
end;
$$;

revoke all on function tribuia.replace_condominium_location(uuid, jsonb, jsonb) from public, anon;
grant execute on function tribuia.replace_condominium_location(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
