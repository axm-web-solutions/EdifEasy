-- ============================================================================
-- PARCHE 02 :: Condominio minimo para poder autoregistrarse
-- ----------------------------------------------------------------------------
-- Ejecutalo SOLO si `npm run check` reporta "No hay condominios ACTIVOS".
--
-- La pantalla /register necesita, como minimo:
--   1 condominio ACTIVE  ->  2 edificios ACTIVE  ->  apartamentos
-- Sin eso el desplegable aparece vacio y no hay apartamento que reclamar.
--
-- A diferencia de `supabase/seed.sql`, este parche NO depende de los usuarios
-- de prueba ni de la clave secreta: crea solo la estructura.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Es idempotente: puedes ejecutarlo varias veces.
--
-- Verificar despues con:  npm run check
-- ============================================================================

do $bootstrap$
declare
  v_condo     uuid;
  v_building  uuid;
  v_buildings text[] := array['1', '2'];
  v_apts      text[] := array['101', '102', '201', '202', '301', '302'];
  i           integer;
  j           integer;
  v_created   integer := 0;
begin
  -- --------------------------------------------------------------------------
  -- 1. Condominio (se identifica por NIT para poder re-ejecutar)
  -- --------------------------------------------------------------------------
  select id into v_condo from tribuia.condominiums where nit = 'BOOTSTRAP-001';

  if v_condo is null then
    insert into tribuia.condominiums
      (name, nit, address, city, country, phone, email, description, status)
    values (
      'Conjunto Residencial Tribuia',
      'BOOTSTRAP-001',
      'Calle 100 # 15-20',
      'Bogota',
      'Colombia',
      '+57 601 000 0000',
      'administracion@tribuia.com',
      'Condominio inicial creado para habilitar el autoregistro.',
      'ACTIVE'
    )
    returning id into v_condo;
    raise notice 'Condominio creado: %', v_condo;
  else
    update tribuia.condominiums set status = 'ACTIVE' where id = v_condo;
    raise notice 'Condominio ya existia (reactivado): %', v_condo;
  end if;

  -- --------------------------------------------------------------------------
  -- 2. Edificios y apartamentos
  -- --------------------------------------------------------------------------
  for i in 1 .. array_length(v_buildings, 1) loop
    select id into v_building
    from tribuia.buildings
    where condominium_id = v_condo and number = v_buildings[i];

    if v_building is null then
      insert into tribuia.buildings (condominium_id, name, number, description, floors, status)
      values (
        v_condo,
        'Edificio ' || v_buildings[i],
        v_buildings[i],
        'Edificio con 6 apartamentos en 3 pisos.',
        3,
        'ACTIVE'
      )
      returning id into v_building;
    else
      update tribuia.buildings set status = 'ACTIVE' where id = v_building;
    end if;

    for j in 1 .. array_length(v_apts, 1) loop
      insert into tribuia.apartments
        (condominium_id, building_id, number, floor, area, bedrooms, bathrooms,
         parking_spots, status, description)
      values (
        v_condo,
        v_building,
        v_apts[j],
        left(v_apts[j], 1)::int,
        65 + (j * 5),
        case when j <= 2 then 2 else 3 end,
        case when j <= 2 then 1 else 2 end,
        1,
        'VACANT',
        'Apartamento ' || v_apts[j] || ' del Edificio ' || v_buildings[i]
      )
      on conflict (building_id, number) do nothing;

      if found then
        v_created := v_created + 1;
      end if;
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 3. Categorias basicas (evitan desplegables vacios en gastos y documentos)
  -- --------------------------------------------------------------------------
  insert into tribuia.expense_categories (condominium_id, name, code, color, description) values
    (v_condo, 'Administracion',    'ADM', '#2559eb', 'Honorarios y gastos administrativos'),
    (v_condo, 'Mantenimiento',     'MTO', '#f59e0b', 'Mantenimiento preventivo y correctivo'),
    (v_condo, 'Servicios publicos','SPU', '#10b981', 'Agua, energia, gas e internet'),
    (v_condo, 'Seguridad',         'SEG', '#ef4444', 'Vigilancia y control de acceso'),
    (v_condo, 'Aseo',              'ASE', '#8b5cf6', 'Aseo y zonas comunes')
  on conflict (condominium_id, name) do nothing;

  insert into tribuia.document_categories (condominium_id, name, description) values
    (v_condo, 'Legal',      'Reglamentos, actas y documentos legales'),
    (v_condo, 'Financiero', 'Presupuestos, estados financieros y facturas'),
    (v_condo, 'Manuales',   'Manuales tecnicos y de operacion')
  on conflict (condominium_id, name) do nothing;

  raise notice 'Listo. Apartamentos nuevos: %. Ya puedes registrarte en /register', v_created;
end
$bootstrap$;

-- ============================================================================
-- Resultado: usa estos valores en la pantalla /register
-- ============================================================================
select c.name        as condominio,
       b.number      as edificio,
       string_agg(a.number, ', ' order by a.number) as apartamentos_disponibles
from tribuia.condominiums c
join tribuia.buildings  b on b.condominium_id = c.id
join tribuia.apartments a on a.building_id = b.id
where c.nit = 'BOOTSTRAP-001'
group by c.name, b.number
order by b.number;
