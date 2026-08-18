-- ============================================================================
-- DIAGNOSTICO :: que hay y que falta en el esquema tribuia
-- ----------------------------------------------------------------------------
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- SOLO LEE. No crea, no modifica y no borra nada: se puede ejecutar cuando sea.
--
-- Devuelve una unica tabla de resultados con tres bloques:
--   1. OBJETOS  -> tablas, tipos y funciones, y que parche los crea si faltan.
--   2. DATOS    -> cuantos condominios, bloques y apartamentos hay disponibles
--                  para la pantalla de registro (un catalogo vacio no es un
--                  error del codigo: es que no hay filas ACTIVE que mostrar).
--   3. RESUMEN  -> que hacer a continuacion.
--
-- Por que existe este archivo:
--   la clave publica del frontend no puede consultar los catalogos de
--   PostgreSQL, asi que `npm run check` solo puede deducir que falta probando
--   una por una. Esta consulta lo mira directamente y no deja lugar a dudas.
--
-- Nota: se comprueba por NOMBRE de constraint y con to_regclass/to_regprocedure,
-- nunca comparando arrays de columnas contra pg_attribute. Esa comparacion es
-- la que fallaba con "operator does not exist: name[] = text[]".
-- ============================================================================

with objetos as (
  select * from (values
    -- (orden, bloque, objeto, existe, lo_crea)
    (11, 'TIPO',     'tribuia.registration_status',
         to_regtype('tribuia.registration_status') is not null,        'parche 01'),
    (12, 'TABLA',    'tribuia.registration_requests',
         to_regclass('tribuia.registration_requests') is not null,     'parche 01'),
    (13, 'FUNCION',  'registration_catalog()',
         to_regprocedure('tribuia.registration_catalog()') is not null, 'parche 01'),
    (14, 'FUNCION',  'registration_buildings(uuid)',
         to_regprocedure('tribuia.registration_buildings(uuid)') is not null, 'parche 01'),
    (15, 'FUNCION',  'registration_apartments(uuid)',
         to_regprocedure('tribuia.registration_apartments(uuid)') is not null, 'parche 01'),
    (16, 'FUNCION',  'complete_self_registration(...)',
         to_regprocedure(
           'tribuia.complete_self_registration(uuid,uuid,uuid,text,jsonb,text)'
         ) is not null, 'parche 01'),
    (17, 'FUNCION',  'my_registration_request()',
         to_regprocedure('tribuia.my_registration_request()') is not null, 'parche 01'),
    (18, 'FUNCION',  'registration_requests_for_review(uuid,text)',
         to_regprocedure(
           'tribuia.registration_requests_for_review(uuid,text)'
         ) is not null, 'parche 01'),
    (19, 'FUNCION',  'approve_registration_request(uuid,text)',
         to_regprocedure(
           'tribuia.approve_registration_request(uuid,text)'
         ) is not null, 'parche 01'),
    (20, 'FUNCION',  'reject_registration_request(uuid,text)',
         to_regprocedure(
           'tribuia.reject_registration_request(uuid,text)'
         ) is not null, 'parche 01'),

    (31, 'TABLA',    'tribuia.condominium_invitations',
         to_regclass('tribuia.condominium_invitations') is not null,   'parche 03'),
    (32, 'FUNCION',  'create_invitation(uuid,text,text,text,uuid)',
         to_regprocedure(
           'tribuia.create_invitation(uuid,text,text,text,uuid)'
         ) is not null, 'parche 03'),
    (33, 'FUNCION',  'revoke_invitation(uuid)',
         to_regprocedure('tribuia.revoke_invitation(uuid)') is not null, 'parche 03'),
    (34, 'FUNCION',  'invitations_for_condominium(uuid,text)',
         to_regprocedure(
           'tribuia.invitations_for_condominium(uuid,text)'
         ) is not null, 'parche 03'),
    (35, 'FUNCION',  'claim_my_invitations()',
         to_regprocedure('tribuia.claim_my_invitations()') is not null, 'parche 03'),

    -- Base que los parches necesitan. Si algo de aqui falta, el problema no es
    -- un parche: es que schema.sql nunca llego a ejecutarse entero.
    (41, 'FUNCION',  'is_condominium_admin(uuid,uuid)',
         to_regprocedure(
           'tribuia.is_condominium_admin(uuid,uuid)'
         ) is not null, 'schema.sql'),
    (42, 'FUNCION',  'fn_audit()',
         to_regprocedure('tribuia.fn_audit()') is not null,            'schema.sql'),
    (43, 'FUNCION',  'set_updated_at()',
         to_regprocedure('tribuia.set_updated_at()') is not null,      'schema.sql'),
    (44, 'CONSTRAINT', 'residents unique(apartment_id, profile_id)',
         exists (
           select 1 from pg_constraint
           where conname = 'residents_apartment_id_profile_id_key'
         ), 'parche 01 (bloque A)')
  ) as t(orden, bloque, objeto, existe, lo_crea)
),

datos as (
  select * from (values
    (61, 'DATOS', 'condominios ACTIVE (los que salen en /register)',
         (select count(*) from tribuia.condominiums where status = 'ACTIVE')),
    (62, 'DATOS', 'condominios en total',
         (select count(*) from tribuia.condominiums)),
    (63, 'DATOS', 'bloques ACTIVE',
         (select count(*) from tribuia.buildings where status = 'ACTIVE')),
    (64, 'DATOS', 'bloques en total',
         (select count(*) from tribuia.buildings)),
    (65, 'DATOS', 'apartamentos seleccionables (status <> INACTIVE)',
         (select count(*) from tribuia.apartments where status <> 'INACTIVE')),
    (66, 'DATOS', 'apartamentos en total',
         (select count(*) from tribuia.apartments)),
    (67, 'DATOS', 'perfiles registrados',
         (select count(*) from tribuia.profiles)),
    (68, 'DATOS', 'membresias ACTIVE (usuarios que pueden entrar)',
         (select count(*) from tribuia.condominium_members where status = 'ACTIVE'))
  ) as t(orden, bloque, objeto, cantidad)
),

faltantes as (
  select count(*) filter (where not existe and lo_crea like 'parche 01%') as f01,
         count(*) filter (where not existe and lo_crea = 'parche 03')     as f03,
         count(*) filter (where not existe and lo_crea = 'schema.sql')    as fbase
  from objetos
)

select orden, bloque, objeto,
       case when existe then 'OK' else 'FALTA' end as estado,
       case when existe then '' else 'lo crea: ' || lo_crea end as accion
from objetos

union all

select orden, bloque, objeto, cantidad::text, ''
from datos

union all

select 90, 'RESUMEN', 'objetos que faltan',
       (select (f01 + f03 + fbase)::text from faltantes),
       (select case
          when fbase > 0
            then 'Falta parte de schema.sql: ejecuta supabase/schema.sql COMPLETO primero'
          when f01 > 0 and f03 > 0
            then 'Ejecuta supabase/patches/01-autoregistro-con-aprobacion.sql y despues 03-invitaciones.sql'
          when f01 > 0
            then 'Ejecuta supabase/patches/01-autoregistro-con-aprobacion.sql'
          when f03 > 0
            then 'Ejecuta supabase/patches/03-invitaciones.sql'
          else 'No falta nada. Si /register sigue vacio, mira el bloque DATOS: hacen falta condominios ACTIVE'
        end from faltantes)

union all

select 91, 'RESUMEN', 'despues de ejecutar los parches', 'verifica',
       'notify pgrst, ''reload schema''; y luego npm run check'

order by orden;
