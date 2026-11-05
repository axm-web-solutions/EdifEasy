-- ============================================================================
-- EdiFeasy :: Tienda de inmobiliarias en espanol e ingles
-- ----------------------------------------------------------------------------
-- A. Titulo y descripcion en ingles de cada propiedad (opcionales: si estan
--    vacios, la tienda en ingles muestra el texto en espanol).
-- B. El RPC publico storefront entrega esos campos y la frase y descripcion
--    en ingles de la inmobiliaria (settings.store.taglineEn / descriptionEn).
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- A. TEXTOS EN INGLES DE LAS PROPIEDADES
-- ============================================================================
alter table tribuia.agency_properties add column if not exists title_en text;
alter table tribuia.agency_properties add column if not exists description_en text;
alter table tribuia.agency_properties drop constraint if exists agency_properties_english_check;
alter table tribuia.agency_properties add constraint agency_properties_english_check check (
  coalesce(char_length(title_en), 0) <= 140
  and coalesce(char_length(description_en), 0) <= 5000
);

-- ============================================================================
-- B. RPC PUBLICOS CON LOS TEXTOS EN INGLES
-- ============================================================================
create or replace function tribuia.storefront_property_json(p tribuia.agency_properties)
returns jsonb
language sql
stable
set search_path = tribuia, public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id, 'code', p.code, 'title', p.title, 'title_en', p.title_en,
    'property_type', p.property_type, 'operation', p.operation, 'status', p.status,
    'rent_price', p.rent_price, 'admin_fee', p.admin_fee, 'sale_price', p.sale_price,
    'neighborhood', p.neighborhood, 'city', p.city, 'stratum', p.stratum,
    'area_m2', p.area_m2, 'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms,
    'parking', p.parking, 'floor', p.floor, 'furnished', p.furnished,
    'pets_allowed', p.pets_allowed, 'amenities', p.amenities,
    'description', p.description, 'description_en', p.description_en,
    'images', p.images, 'published_at', p.published_at,
    -- Ubicacion aproximada (~100 m): la direccion exacta no sale de la base.
    'lat', round(p.latitude, 3), 'lng', round(p.longitude, 3)
  );
$$;

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
        'description_en', c.settings -> 'store' ->> 'descriptionEn',
        'whatsapp', c.settings ->> 'whatsapp', 'primary_color', c.settings ->> 'primaryColor',
        'hero_image', c.settings -> 'store' ->> 'heroImage',
        'hero_video', c.settings -> 'store' ->> 'heroVideo',
        'tagline', c.settings -> 'store' ->> 'tagline',
        'tagline_en', c.settings -> 'store' ->> 'taglineEn'
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

notify pgrst, 'reload schema';
