-- ============================================================================
-- EdiFeasy :: Clasificados del marketplace (publicaciones de los residentes)
-- ----------------------------------------------------------------------------
--   A. marketplace_listings: lo que publican los miembros del conjunto
--      (articulos, arriendos, comida, accesorios, clases, servicios...).
--   B. Moderacion: toda publicacion entra PENDING y solo la administracion la
--      aprueba (review_marketplace_listing). Si el autor cambia el contenido
--      de una publicacion aprobada, vuelve a PENDING. Aprobada dura 60 dias.
--   C. Notificaciones: a la administracion al llegar una publicacion por
--      aprobar y al autor cuando se aprueba o rechaza.
--   D. Storage: bucket privado `marketplace` con rutas
--      <condominium_id>/listings/<user_id>/<archivo>.
--
-- Usa el modulo existente 'marketplace'. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. TABLA
-- ----------------------------------------------------------------------------
create table if not exists tribuia.marketplace_listings (
  id               uuid primary key default gen_random_uuid(),
  condominium_id   uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id     uuid references tribuia.apartments (id) on delete set null,
  category         text not null,
  title            text not null,
  description      text not null,
  price            numeric(14, 2),
  price_type       text not null default 'FIXED',
  item_condition   text,
  details          jsonb not null default '{}'::jsonb,
  images           jsonb not null default '[]'::jsonb,
  contact_phone    text,
  contact_whatsapp text,
  status           text not null default 'PENDING',
  review_notes     text,
  reviewed_by      uuid references tribuia.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  published_at     timestamptz,
  expires_at       timestamptz,
  created_by       uuid not null default auth.uid() references tribuia.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint marketplace_listings_category_check check (category in (
    'PRODUCTS', 'PROPERTY_RENT', 'PROPERTY_SALE', 'FOOD', 'ACCESSORIES', 'CLASSES', 'SERVICES', 'OTHER'
  )),
  constraint marketplace_listings_price_type_check check (price_type in (
    'FIXED', 'NEGOTIABLE', 'FREE', 'PER_HOUR', 'PER_MONTH', 'PER_UNIT'
  )),
  constraint marketplace_listings_condition_check check (
    item_condition is null or item_condition in ('NEW', 'USED')
  ),
  constraint marketplace_listings_status_check check (status in (
    'PENDING', 'APPROVED', 'REJECTED', 'SOLD', 'ARCHIVED'
  )),
  constraint marketplace_listings_title_check check (length(btrim(title)) between 3 and 120),
  constraint marketplace_listings_description_check check (length(btrim(description)) between 10 and 3000),
  constraint marketplace_listings_price_check check (price is null or price between 0 and 99999999999),
  constraint marketplace_listings_details_check check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4000
  ),
  constraint marketplace_listings_images_check check (
    jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 6
  ),
  constraint marketplace_listings_lengths_check check (
    coalesce(length(contact_phone), 0) <= 30
    and coalesce(length(contact_whatsapp), 0) <= 30
    and coalesce(length(review_notes), 0) <= 500
  )
);

comment on table tribuia.marketplace_listings is
  'Clasificados de los miembros del conjunto. Solo se ven aprobados y vigentes (o los propios). Moderados por la administracion.';

create index if not exists idx_marketplace_listings_feed
  on tribuia.marketplace_listings (condominium_id, status, published_at desc);
create index if not exists idx_marketplace_listings_created_by
  on tribuia.marketplace_listings (created_by);
create index if not exists idx_marketplace_listings_apartment
  on tribuia.marketplace_listings (apartment_id);
create index if not exists idx_marketplace_listings_reviewed_by
  on tribuia.marketplace_listings (reviewed_by);

drop trigger if exists trg_marketplace_listings_updated_at on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_updated_at before update on tribuia.marketplace_listings
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_marketplace_listings_lock_tenant on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_lock_tenant before update on tribuia.marketplace_listings
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id', 'created_by');
drop trigger if exists trg_marketplace_listings_tenant_ref on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_tenant_ref before insert or update on tribuia.marketplace_listings
  for each row execute function tribuia.tg_assert_tenant_reference();
drop trigger if exists trg_audit_marketplace_listings on tribuia.marketplace_listings;
create trigger trg_audit_marketplace_listings
  after insert or update or delete on tribuia.marketplace_listings
  for each row execute function tribuia.fn_audit('CREATE');


-- ----------------------------------------------------------------------------
-- B. REGLAS (triggers) Y MODERACION
-- ----------------------------------------------------------------------------
-- Las fotos deben estar en la carpeta del autor dentro del conjunto.
create or replace function tribuia.marketplace_images_valid(
  p_images      jsonb,
  p_condominium uuid,
  p_author      uuid
)
returns boolean
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select coalesce(bool_and(
           jsonb_typeof(value) = 'string'
           and (value #>> '{}') like p_condominium::text || '/listings/' || p_author::text || '/%'
           and length(value #>> '{}') <= 300
         ), true)
    from jsonb_array_elements(coalesce(p_images, '[]'::jsonb));
$$;

create or replace function tribuia.tg_marketplace_listing_before_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_admin boolean;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  v_admin := tribuia.is_condominium_admin(new.condominium_id, new.created_by);

  if new.apartment_id is not null and not v_admin
     and new.apartment_id not in (select tribuia.user_apartment_ids(new.created_by)) then
    raise exception 'Solo puedes publicar a nombre de tu propio apartamento' using errcode = '42501';
  end if;

  if not tribuia.marketplace_images_valid(new.images, new.condominium_id, new.created_by) then
    raise exception 'Las fotos no pertenecen a esta publicacion' using errcode = '22023';
  end if;

  -- Antispam: maximo 10 publicaciones activas por persona en el conjunto.
  if not v_admin and (
    select count(*) from tribuia.marketplace_listings
     where condominium_id = new.condominium_id
       and created_by = new.created_by
       and status in ('PENDING', 'APPROVED')
  ) >= 10 then
    raise exception 'Tienes 10 publicaciones activas. Marca alguna como vendida o archivala.'
      using errcode = 'P0001';
  end if;

  -- La administracion publica directo; el resto espera aprobacion.
  new.review_notes := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  if v_admin then
    new.status := 'APPROVED';
    new.published_at := now();
    new.expires_at := now() + interval '60 days';
  else
    new.status := 'PENDING';
    new.published_at := null;
    new.expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_listings_before_insert on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_before_insert before insert on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_before_insert();

create or replace function tribuia.tg_marketplace_listing_before_update()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_content_changed boolean;
begin
  -- Service role / SQL Editor: sin restricciones. (La RPC de moderacion corre
  -- con el JWT del administrador y pasa por la rama de administracion.)
  if auth.uid() is null then
    return new;
  end if;

  if not tribuia.marketplace_images_valid(new.images, new.condominium_id, new.created_by) then
    raise exception 'Las fotos no pertenecen a esta publicacion' using errcode = '22023';
  end if;

  if tribuia.is_condominium_admin(new.condominium_id) then
    return new;
  end if;

  -- El autor no se aprueba ni se modera a si mismo.
  if new.status is distinct from old.status and new.status not in ('SOLD', 'ARCHIVED', 'PENDING') then
    raise exception 'Solo la administracion aprueba publicaciones' using errcode = '42501';
  end if;
  new.review_notes := old.review_notes;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.published_at := old.published_at;
  new.expires_at := old.expires_at;

  if new.apartment_id is distinct from old.apartment_id and new.apartment_id is not null
     and new.apartment_id not in (select tribuia.user_apartment_ids()) then
    raise exception 'Solo puedes publicar a nombre de tu propio apartamento' using errcode = '42501';
  end if;

  v_content_changed :=
    (new.category, new.title, new.description, new.price, new.price_type, new.item_condition,
     new.details, new.images, new.contact_phone, new.contact_whatsapp, new.apartment_id)
    is distinct from
    (old.category, old.title, old.description, old.price, old.price_type, old.item_condition,
     old.details, old.images, old.contact_phone, old.contact_whatsapp, old.apartment_id);

  -- Contenido nuevo (o republicar algo vendido/archivado) vuelve a revision.
  if (v_content_changed and new.status not in ('SOLD', 'ARCHIVED'))
     or (new.status = 'PENDING' and old.status <> 'PENDING') then
    new.status := 'PENDING';
    new.review_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.published_at := null;
    new.expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_listings_before_update on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_before_update before update on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_before_update();

revoke execute on function tribuia.tg_marketplace_listing_before_insert() from public, anon, authenticated;
revoke execute on function tribuia.tg_marketplace_listing_before_update() from public, anon, authenticated;

-- Aprobar o rechazar (administracion). Avisa al autor.
create or replace function tribuia.review_marketplace_listing(
  p_listing uuid,
  p_approve boolean,
  p_notes   text default null
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.marketplace_listings%rowtype;
  v_status text;
begin
  select * into v_row from tribuia.marketplace_listings where id = p_listing for update;
  if v_row.id is null then
    raise exception 'La publicacion no existe' using errcode = 'P0002';
  end if;
  if not tribuia.is_condominium_admin(v_row.condominium_id) then
    raise exception 'Solo la administracion modera el marketplace' using errcode = '42501';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Esta publicacion ya fue revisada' using errcode = 'P0001';
  end if;

  v_status := case when p_approve then 'APPROVED' else 'REJECTED' end;
  update tribuia.marketplace_listings
     set status = v_status,
         review_notes = nullif(btrim(coalesce(p_notes, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         published_at = case when p_approve then now() else null end,
         expires_at = case when p_approve then now() + interval '60 days' else null end
   where id = p_listing;

  insert into tribuia.notifications
    (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  values (
    v_row.condominium_id, v_row.created_by,
    case when p_approve then 'Tu publicacion fue aprobada' else 'Tu publicacion no fue aprobada' end,
    left(v_row.title || coalesce(' — ' || nullif(btrim(coalesce(p_notes, '')), ''), ''), 240),
    'SYSTEM', 'LOW', 'marketplace_listings', v_row.id, '/marketplace?tab=mias'
  );
  return v_status;
end;
$$;

-- Aviso a la administracion cuando llega algo por aprobar.
create or replace function tribuia.tg_marketplace_listing_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status = 'PENDING' and (tg_op = 'INSERT' or old.status is distinct from 'PENDING') then
    insert into tribuia.notifications
      (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select new.condominium_id, m.user_id, 'Publicacion por aprobar en el marketplace',
           left(new.title, 240), 'SYSTEM', 'LOW', 'marketplace_listings', new.id,
           '/marketplace?tab=revisar'
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id and r.code = 'ADMINISTRATOR'
     where m.condominium_id = new.condominium_id
       and m.status = 'ACTIVE'
       and m.user_id <> new.created_by;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_marketplace_listings_notify on tribuia.marketplace_listings;
create trigger trg_marketplace_listings_notify
  after insert or update of status on tribuia.marketplace_listings
  for each row execute function tribuia.tg_marketplace_listing_notify();

revoke execute on function tribuia.tg_marketplace_listing_notify() from public, anon, authenticated;
revoke all on function tribuia.review_marketplace_listing(uuid, boolean, text) from public, anon;
grant execute on function tribuia.review_marketplace_listing(uuid, boolean, text) to authenticated, service_role;
grant execute on function tribuia.marketplace_images_valid(jsonb, uuid, uuid) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table tribuia.marketplace_listings enable row level security;

drop policy if exists marketplace_listings_select on tribuia.marketplace_listings;
create policy marketplace_listings_select on tribuia.marketplace_listings for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
    and (
      (status = 'APPROVED' and (expires_at is null or expires_at > now()))
      or created_by = (select auth.uid())
      or tribuia.is_condominium_admin(condominium_id)
    )
  );

drop policy if exists marketplace_listings_insert on tribuia.marketplace_listings;
create policy marketplace_listings_insert on tribuia.marketplace_listings for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and tribuia.user_can_access_condominium(condominium_id)
    and condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
  );

drop policy if exists marketplace_listings_update on tribuia.marketplace_listings;
create policy marketplace_listings_update on tribuia.marketplace_listings for update to authenticated
  using (created_by = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id))
  with check (
    (created_by = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('marketplace'))
  );

drop policy if exists marketplace_listings_delete on tribuia.marketplace_listings;
create policy marketplace_listings_delete on tribuia.marketplace_listings for delete to authenticated
  using (created_by = (select auth.uid()) or tribuia.is_condominium_admin(condominium_id));

revoke all on tribuia.marketplace_listings from anon;
grant select, insert, update, delete on tribuia.marketplace_listings to authenticated;
grant all on tribuia.marketplace_listings to service_role;


-- ----------------------------------------------------------------------------
-- D. STORAGE: fotos de las publicaciones
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace', 'marketplace', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  drop policy if exists edifeasy_marketplace_read on storage.objects;
  drop policy if exists edifeasy_marketplace_write on storage.objects;
  drop policy if exists edifeasy_marketplace_delete on storage.objects;

  -- Ruta: <condominium_id>/listings/<user_id>/<archivo>
  execute $pol$
    create policy edifeasy_marketplace_read on storage.objects for select to authenticated
    using (
      bucket_id = 'marketplace'
      and tribuia.user_can_access_condominium(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_marketplace_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'marketplace'
      and (storage.foldername(name))[2] = 'listings'
      and (storage.foldername(name))[3] = (select auth.uid())::text
      and tribuia.user_can_access_condominium(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_marketplace_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'marketplace'
      and (
        (storage.foldername(name))[3] = (select auth.uid())::text
        or tribuia.is_condominium_admin(tribuia.safe_uuid((storage.foldername(name))[1]))
      )
    )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;

notify pgrst, 'reload schema';
