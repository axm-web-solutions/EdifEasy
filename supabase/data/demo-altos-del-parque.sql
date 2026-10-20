-- ============================================================================
-- EdiFeasy :: Datos de prueba del conjunto DEMO "Conjunto Residencial Altos del Parque"
-- ----------------------------------------------------------------------------
--   * 8 publicaciones del feed (fijada, por bloque y para propietarios).
--   * 13 productos del marketplace con foto, ya aprobados (articulos,
--     arriendo, venta, comida, accesorios, clases y servicios).
--   * Cuotas de administracion de octubre 2026 pendientes, para probar el pago.
--
-- Las fotos ya estan subidas en Storage (bucket marketplace) en la carpeta de
-- cada vendedor demo. NO ejecutar en conjuntos reales.
-- Idempotente: si ya existen (mismo titulo), no se duplican.
-- Para borrarlos: ver el bloque "LIMPIEZA" al final.
-- ============================================================================

do $$
declare
  c_condo  constant uuid := '9d2f696c-a59f-4c25-af84-2ddbfff4c99c';
  v_admin  uuid;
  v_owner_role uuid;
  v_building uuid;
  v_id     uuid;
  v_apt    uuid;
  v_phone  text;
begin
  if not exists (select 1 from tribuia.condominiums where id = c_condo and name = 'Conjunto Residencial Altos del Parque') then
    raise exception 'No se encontro el conjunto demo Altos del Parque';
  end if;

  select m.user_id into v_admin
    from tribuia.condominium_members m join tribuia.roles r on r.id = m.role_id
   where m.condominium_id = c_condo and r.code = 'ADMINISTRATOR' and m.status = 'ACTIVE'
   order by m.created_at limit 1;
  select id into v_owner_role from tribuia.roles where code = 'OWNER';
  select id into v_building from tribuia.buildings where condominium_id = c_condo order by number limit 1;

  -- --------------------------------------------------------------- A. feed
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Bienvenidos al nuevo inicio de EdiFeasy') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Bienvenidos al nuevo inicio de EdiFeasy', 'Desde hoy el inicio de la plataforma es este feed: aqui veras los anuncios de la administracion, los numeros de emergencia y el marketplace de vecinos. Cualquier duda, escribenos por Mensajes.', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=75&fm=jpg&fit=crop', 'CONDOMINIUM', null, null,
            true, 'PUBLISHED', now() - interval '0 days' - interval '0 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Mantenimiento de fachada y tanques de agua') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Mantenimiento de fachada y tanques de agua', 'Entre el lunes y el viernes de la proxima semana se hara mantenimiento a la fachada y lavado de tanques. Habra personal en las zonas comunes de 8 am a 5 pm.', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=75&fm=jpg&fit=crop', 'CONDOMINIUM', null, null,
            false, 'PUBLISHED', now() - interval '1 days' - interval '3 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Integracion de vecinos: noche de comidas') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Integracion de vecinos: noche de comidas', 'Este sabado a las 7 pm en el salon social. Trae un plato para compartir. Habra musica y actividades para los ninos.', 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=75&fm=jpg&fit=crop', 'CONDOMINIUM', null, null,
            false, 'PUBLISHED', now() - interval '2 days' - interval '6 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Corte de agua programado el jueves') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Corte de agua programado el jueves', 'La empresa de acueducto informo un corte de 9 am a 2 pm por obras en la red principal. Te recomendamos almacenar agua.', null, 'CONDOMINIUM', null, null,
            false, 'PUBLISHED', now() - interval '3 days' - interval '9 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Recordatorio: cuota de administracion de octubre') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Recordatorio: cuota de administracion de octubre', 'La cuota de octubre ya esta disponible. Puedes pagarla en linea desde "Cuotas de administracion" con PSE, tarjeta o Nequi.', null, 'ROLE', v_owner_role, null,
            false, 'PUBLISHED', now() - interval '4 days' - interval '12 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Pintura de escaleras') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Pintura de escaleras', 'Esta semana se pintaran las escaleras del bloque. Usa el ascensor o la escalera de emergencia mientras se seca la pintura.', null, 'BUILDING', null, v_building,
            false, 'PUBLISHED', now() - interval '5 days' - interval '15 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Fumigacion de zonas comunes') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Fumigacion de zonas comunes', 'El miercoles se fumigaran parqueaderos, shut de basuras y jardines. Manten las mascotas dentro del apartamento durante la manana.', null, 'CONDOMINIUM', null, null,
            false, 'PUBLISHED', now() - interval '6 days' - interval '18 hours', v_admin);
  end if;
  if not exists (select 1 from tribuia.announcements where condominium_id = c_condo and title = 'Normas para mascotas en zonas comunes') then
    insert into tribuia.announcements
      (condominium_id, title, content, image_url, audience, audience_role_id, building_id, pinned, status, published_at, created_by)
    values (c_condo, 'Normas para mascotas en zonas comunes', 'Recuerda llevar a tu mascota con correa y recoger sus desechos. Las zonas de juego infantil no permiten mascotas.', null, 'CONDOMINIUM', null, null,
            false, 'PUBLISHED', now() - interval '8 days' - interval '24 hours', v_admin);
  end if;

  -- --------------------------------------------------------------- B. marketplace
  -- propietario1@edifeasy.com: Bicicleta urbana rin 28
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Bicicleta urbana rin 28') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PRODUCTS', 'Bicicleta urbana rin 28', 'Bicicleta urbana en muy buen estado, cambios Shimano, frenos revisados. Ideal para moverse por la ciudad.', 650000, 'NEGOTIABLE', 'USED',
            '{}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/badd3865-3615-40ef-95c9-09a4e0ec8a09/demo-bicicleta.jpg"]'::jsonb, v_phone, v_phone, 'badd3865-3615-40ef-95c9-09a4e0ec8a09')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario1@edifeasy.com: Sofa de 3 puestos verde esmeralda
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Sofa de 3 puestos verde esmeralda') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PRODUCTS', 'Sofa de 3 puestos verde esmeralda', 'Sofa en tela, 2 anos de uso, sin manchas. Lo entrego en el apartamento, lo recogen en el conjunto.', 900000, 'FIXED', 'USED',
            '{}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/badd3865-3615-40ef-95c9-09a4e0ec8a09/demo-sofa.jpg"]'::jsonb, v_phone, v_phone, 'badd3865-3615-40ef-95c9-09a4e0ec8a09')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario1@edifeasy.com: Tortas de chocolate por encargo
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Tortas de chocolate por encargo') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'badd3865-3615-40ef-95c9-09a4e0ec8a09';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'FOOD', 'Tortas de chocolate por encargo', 'Torta humeda de chocolate con ganache. Porcion para 12 personas. Tambien hago tortas de cumpleanos personalizadas.', 45000, 'PER_UNIT', null,
            '{"delivery": true, "schedule": "Pedidos con 2 dias de anticipacion"}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/badd3865-3615-40ef-95c9-09a4e0ec8a09/demo-tortas.jpg"]'::jsonb, v_phone, v_phone, 'badd3865-3615-40ef-95c9-09a4e0ec8a09')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario2@edifeasy.com: Arriendo apartamento de 2 habitaciones
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Arriendo apartamento de 2 habitaciones') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PROPERTY_RENT', 'Arriendo apartamento de 2 habitaciones', 'Apartamento iluminado, cocina integral, balcon y parqueadero cubierto. Disponible desde noviembre.', 1800000, 'PER_MONTH', null,
            '{"bedrooms": 2, "bathrooms": 2, "area_m2": 68, "parking": true}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/ee1db33b-c3c6-4087-9bc6-242f127d3506/demo-arriendo.jpg"]'::jsonb, v_phone, v_phone, 'ee1db33b-c3c6-4087-9bc6-242f127d3506')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario2@edifeasy.com: Par de butacos de madera
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Par de butacos de madera') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PRODUCTS', 'Par de butacos de madera', 'Butacos altos en madera de pino, perfectos para barra de cocina. Nuevos, sin uso.', 180000, 'FIXED', 'NEW',
            '{}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/ee1db33b-c3c6-4087-9bc6-242f127d3506/demo-butaco.jpg"]'::jsonb, v_phone, v_phone, 'ee1db33b-c3c6-4087-9bc6-242f127d3506')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario2@edifeasy.com: Hamburguesas artesanales los fines de semana
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Hamburguesas artesanales los fines de semana') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'ee1db33b-c3c6-4087-9bc6-242f127d3506';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'FOOD', 'Hamburguesas artesanales los fines de semana', 'Carne de res de 180 g, pan brioche y papas a la francesa. Entrego en la porteria.', 22000, 'PER_UNIT', null,
            '{"delivery": true, "schedule": "Viernes y sabados de 6 a 10 pm"}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/ee1db33b-c3c6-4087-9bc6-242f127d3506/demo-hamburguesas.jpg"]'::jsonb, v_phone, v_phone, 'ee1db33b-c3c6-4087-9bc6-242f127d3506')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario3@edifeasy.com: Clases de yoga en el salon social
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Clases de yoga en el salon social') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'CLASSES', 'Clases de yoga en el salon social', 'Yoga para principiantes y nivel intermedio. Grupos pequenos. Trae tu tapete.', 25000, 'PER_HOUR', null,
            '{"modality": "IN_PERSON", "schedule": "Martes y jueves 6:00 am"}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/d54e246b-e6cb-4881-b60b-32b01d4360d1/demo-yoga.jpg"]'::jsonb, v_phone, v_phone, 'd54e246b-e6cb-4881-b60b-32b01d4360d1')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario3@edifeasy.com: Libros de emprendimiento y negocios
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Libros de emprendimiento y negocios') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PRODUCTS', 'Libros de emprendimiento y negocios', 'Coleccion de libros de negocios en buen estado. Se venden por unidad o el lote completo.', 20000, 'PER_UNIT', 'USED',
            '{}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/d54e246b-e6cb-4881-b60b-32b01d4360d1/demo-libros.jpg"]'::jsonb, v_phone, v_phone, 'd54e246b-e6cb-4881-b60b-32b01d4360d1')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario3@edifeasy.com: Casa campestre en venta
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Casa campestre en venta') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = 'd54e246b-e6cb-4881-b60b-32b01d4360d1';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PROPERTY_SALE', 'Casa campestre en venta', 'Casa moderna de 4 habitaciones con jardin, zona BBQ y vista a las montanas. A 10 minutos del conjunto.', 850000000, 'NEGOTIABLE', null,
            '{"bedrooms": 4, "bathrooms": 3, "area_m2": 240, "parking": true}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/d54e246b-e6cb-4881-b60b-32b01d4360d1/demo-casa.jpg"]'::jsonb, v_phone, v_phone, 'd54e246b-e6cb-4881-b60b-32b01d4360d1')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario4@edifeasy.com: Portatil 13 pulgadas
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Portatil 13 pulgadas') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = '1ad7711d-6722-49e6-bcb0-8b12072f1df7' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = '1ad7711d-6722-49e6-bcb0-8b12072f1df7' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = '1ad7711d-6722-49e6-bcb0-8b12072f1df7';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'PRODUCTS', 'Portatil 13 pulgadas', 'Portatil liviano, 16 GB de RAM, 512 GB SSD. Bateria en excelente estado. Incluye cargador.', 2300000, 'NEGOTIABLE', 'USED',
            '{}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/1ad7711d-6722-49e6-bcb0-8b12072f1df7/demo-portatil.jpg"]'::jsonb, v_phone, v_phone, '1ad7711d-6722-49e6-bcb0-8b12072f1df7')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- propietario4@edifeasy.com: Anchetas y cajas de regalo
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Anchetas y cajas de regalo') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = '1ad7711d-6722-49e6-bcb0-8b12072f1df7' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = '1ad7711d-6722-49e6-bcb0-8b12072f1df7' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = '1ad7711d-6722-49e6-bcb0-8b12072f1df7';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'ACCESSORIES', 'Anchetas y cajas de regalo', 'Cajas de regalo personalizadas para cumpleanos, aniversarios y fechas especiales.', 60000, 'PER_UNIT', 'NEW',
            '{"schedule": "Entrega en 24 horas"}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/1ad7711d-6722-49e6-bcb0-8b12072f1df7/demo-anchetas.jpg"]'::jsonb, v_phone, v_phone, '1ad7711d-6722-49e6-bcb0-8b12072f1df7')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- arrendatario1@edifeasy.com: Aseo por dias en apartamentos
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Aseo por dias en apartamentos') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = '496bc94a-658a-4720-b3ea-6aeeab3ef272' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = '496bc94a-658a-4720-b3ea-6aeeab3ef272' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = '496bc94a-658a-4720-b3ea-6aeeab3ef272';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'SERVICES', 'Aseo por dias en apartamentos', 'Aseo general, cocina y banos. Llevo los implementos. Referencias de vecinos del conjunto.', 90000, 'FIXED', null,
            '{"schedule": "Lunes a sabado"}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/496bc94a-658a-4720-b3ea-6aeeab3ef272/demo-aseo.jpg"]'::jsonb, v_phone, v_phone, '496bc94a-658a-4720-b3ea-6aeeab3ef272')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;
  -- arrendatario1@edifeasy.com: Sacos tejidos a mano
  if not exists (select 1 from tribuia.marketplace_listings where condominium_id = c_condo and title = 'Sacos tejidos a mano') then
    select coalesce((select apartment_id from tribuia.apartment_owners where profile_id = '496bc94a-658a-4720-b3ea-6aeeab3ef272' and is_active limit 1),
                    (select apartment_id from tribuia.apartment_tenants where profile_id = '496bc94a-658a-4720-b3ea-6aeeab3ef272' and is_active limit 1))
      into v_apt;
    select coalesce(phone, '3001000000') into v_phone from tribuia.profiles where id = '496bc94a-658a-4720-b3ea-6aeeab3ef272';
    insert into tribuia.marketplace_listings
      (condominium_id, apartment_id, category, title, description, price, price_type, item_condition,
       details, images, contact_phone, contact_whatsapp, created_by)
    values (c_condo, v_apt, 'ACCESSORIES', 'Sacos tejidos a mano', 'Sacos de lana tejidos a mano en varios colores y tallas. Tambien recibo pedidos.', 120000, 'PER_UNIT', 'NEW',
            '{}'::jsonb, '["9d2f696c-a59f-4c25-af84-2ddbfff4c99c/listings/496bc94a-658a-4720-b3ea-6aeeab3ef272/demo-sacos.jpg"]'::jsonb, v_phone, v_phone, '496bc94a-658a-4720-b3ea-6aeeab3ef272')
    returning id into v_id;
    -- Aprobada por la administracion (en el SQL Editor no hay usuario: se fija directo).
    update tribuia.marketplace_listings
       set status = 'APPROVED', reviewed_by = v_admin, reviewed_at = now(),
           published_at = now() - (random() * interval '5 days'), expires_at = now() + interval '60 days'
     where id = v_id;
  end if;

  -- --------------------------------------------------------------- C. cuotas de octubre
  insert into tribuia.admin_fees (condominium_id, apartment_id, period, amount, due_date)
  select c_condo, a.id, date '2026-10-01', 320000, date '2026-10-31'
    from tribuia.apartments a
   where a.condominium_id = c_condo
     and exists (select 1 from tribuia.apartment_owners o where o.apartment_id = a.id and o.is_active)
     and not exists (select 1 from tribuia.admin_fees f where f.apartment_id = a.id and f.period = date '2026-10-01');

  raise notice 'Datos de prueba listos en Altos del Parque';
end
$$;

-- Verificacion
select
  (select count(*) from tribuia.announcements where condominium_id = '9d2f696c-a59f-4c25-af84-2ddbfff4c99c') as publicaciones,
  (select count(*) from tribuia.marketplace_listings where condominium_id = '9d2f696c-a59f-4c25-af84-2ddbfff4c99c' and status = 'APPROVED') as productos_aprobados,
  (select count(*) from tribuia.admin_fees where condominium_id = '9d2f696c-a59f-4c25-af84-2ddbfff4c99c' and status = 'PENDING') as cuotas_pendientes;

-- ============================================================================
-- LIMPIEZA (opcional): descomentar para borrar los datos de prueba
-- ============================================================================
-- delete from tribuia.marketplace_listings where condominium_id = '9d2f696c-a59f-4c25-af84-2ddbfff4c99c' and title in (
--   'Bicicleta urbana rin 28', 'Sofa de 3 puestos verde esmeralda', 'Tortas de chocolate por encargo', 'Arriendo apartamento de 2 habitaciones', 'Par de butacos de madera', 'Hamburguesas artesanales los fines de semana', 'Clases de yoga en el salon social', 'Libros de emprendimiento y negocios', 'Casa campestre en venta', 'Portatil 13 pulgadas', 'Anchetas y cajas de regalo', 'Aseo por dias en apartamentos', 'Sacos tejidos a mano');
-- delete from tribuia.announcements where condominium_id = '9d2f696c-a59f-4c25-af84-2ddbfff4c99c' and title in (
--   'Bienvenidos al nuevo inicio de EdiFeasy', 'Mantenimiento de fachada y tanques de agua', 'Integracion de vecinos: noche de comidas', 'Corte de agua programado el jueves', 'Recordatorio: cuota de administracion de octubre', 'Pintura de escaleras', 'Fumigacion de zonas comunes', 'Normas para mascotas en zonas comunes');
-- delete from tribuia.admin_fees where condominium_id = '9d2f696c-a59f-4c25-af84-2ddbfff4c99c' and period = date '2026-10-01' and status = 'PENDING';
