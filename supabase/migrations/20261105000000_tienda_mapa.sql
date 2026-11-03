-- ============================================================================
-- EdiFeasy :: Tienda de inmobiliarias con mapa y portada personalizada
-- ----------------------------------------------------------------------------
-- A. Coordenadas de cada propiedad. La tienda publica solo recibe una
--    ubicacion APROXIMADA (redondeada a 3 decimales, ~100 m): nunca la exacta.
-- B. Portada de la tienda (settings.store: heroImage, heroVideo, tagline),
--    expuesta en el RPC storefront.
-- C. Bucket `media`: admite videos cortos (mp4/webm) para la portada, en la
--    carpeta <espacio>/store/.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- A. UBICACION DE LAS PROPIEDADES
-- ============================================================================
alter table tribuia.agency_properties add column if not exists latitude numeric(9, 6);
alter table tribuia.agency_properties add column if not exists longitude numeric(9, 6);
alter table tribuia.agency_properties drop constraint if exists agency_properties_coords_check;
alter table tribuia.agency_properties add constraint agency_properties_coords_check check (
  (latitude is null and longitude is null)
  or (latitude between -90 and 90 and longitude between -180 and 180)
);

create or replace function tribuia.storefront_property_json(p tribuia.agency_properties)
returns jsonb
language sql
stable
set search_path = tribuia, public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id, 'code', p.code, 'title', p.title, 'property_type', p.property_type,
    'operation', p.operation, 'status', p.status,
    'rent_price', p.rent_price, 'admin_fee', p.admin_fee, 'sale_price', p.sale_price,
    'neighborhood', p.neighborhood, 'city', p.city, 'stratum', p.stratum,
    'area_m2', p.area_m2, 'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms,
    'parking', p.parking, 'floor', p.floor, 'furnished', p.furnished,
    'pets_allowed', p.pets_allowed, 'amenities', p.amenities,
    'description', p.description, 'images', p.images, 'published_at', p.published_at,
    -- Ubicacion aproximada (~100 m): la direccion exacta no sale de la base.
    'lat', round(p.latitude, 3), 'lng', round(p.longitude, 3)
  );
$$;

-- ============================================================================
-- B. PORTADA DE LA TIENDA
-- ============================================================================
create or replace function tribuia.storefront(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_id uuid := tribuia.storefront_agency_id(p_slug);
begin
  if v_id is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'agency', jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'logo_url', c.logo_url,
        'city', c.city, 'phone', c.phone, 'email', c.email, 'description', c.description,
        'whatsapp', c.settings ->> 'whatsapp', 'primary_color', c.settings ->> 'primaryColor',
        'hero_image', c.settings -> 'store' ->> 'heroImage',
        'hero_video', c.settings -> 'store' ->> 'heroVideo',
        'tagline', c.settings -> 'store' ->> 'tagline'
      ),
      'properties', coalesce((
        select jsonb_agg(tribuia.storefront_property_json(p) order by p.published_at desc)
          from tribuia.agency_properties p
         where p.condominium_id = c.id and p.is_published and p.status in ('AVAILABLE', 'RESERVED')
      ), '[]'::jsonb)
    )
    from tribuia.condominiums c where c.id = v_id
  );
end;
$$;

grant execute on function tribuia.storefront_property_json(tribuia.agency_properties) to anon, authenticated, service_role;
grant execute on function tribuia.storefront(text) to anon, authenticated, service_role;

-- ============================================================================
-- C. VIDEOS DE PORTADA EN EL BUCKET MEDIA
-- ============================================================================
update storage.buckets
   set file_size_limit = 26214400,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm']
 where id = 'media';

do $$
begin
  drop policy if exists edifeasy_media_write on storage.objects;
  execute $pol$
    create policy edifeasy_media_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[2] in ('announcements', 'logo', 'properties', 'store')
      and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]),
                           array['ADMINISTRATOR', 'SPOKESPERSON'])
    )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;

notify pgrst, 'reload schema';
