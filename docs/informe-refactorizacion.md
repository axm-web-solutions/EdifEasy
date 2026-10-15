# Informe de análisis y refactorización — EdiFeasy

> **Proyecto:** `EdifEasy` (SaaS multi-tenant para administración de condominios)
> **Fecha del análisis:** 15 de octubre de 2026
> **Alcance:** frontend (`src/`), scripts, Edge Functions y base de datos (`esquema tribuia`)
> **Método:** lectura completa del código + inspección de la base de datos real vía Supabase
> (proyecto `pgwtfnipasabidtfgiax`, PostgreSQL 17.6) con `pg_catalog`, `pg_stat_user_tables`,
> `pg_policies`, `pg_index` y los *advisors* de seguridad/rendimiento.

---

## 0. Resumen ejecutivo

EdiFeasy está **bien construido para su tamaño**: TypeScript estricto, capas separadas
(`services` → `hooks` → `features`), RLS como única fuente de verdad de seguridad, manejo
centralizado de errores y logging, esquema multi-tenant coherente y documentación funcional
en `docs/`.

Los problemas encontrados **no son de diseño general, son de consistencia y de escala**:

| Área | Diagnóstico |
| ---- | ----------- |
| Seguridad | Sólida en `tribuia`. **Riesgo crítico fuera del proyecto**: 13 tablas de `public` (otras apps del mismo proyecto Supabase) están sin RLS y expuestas con la anon key. |
| Rendimiento de BD | Las funciones auxiliares de RLS se evalúan **una vez por fila** en lugar de una vez por consulta (evidencia: 111.461 lecturas de índice en `roles`, tabla de 7 filas). Búsquedas con `ILIKE '%texto%'` sin índices GIN trigram → *seq scans*. |
| Rendimiento de app | El dashboard dispara 8-9 consultas simultáneas; los reportes agregan en JavaScript lo que PostgreSQL debería agregar con `GROUP BY`. |
| Consistencia | Dos fuentes de verdad del esquema (`schema.sql` y `migrations/`), que ya divergieron en 331 líneas. Además hay una tabla en la base que no existe en el repo (`condominium_places`). |
| Deuda estructural | `ApartmentDetailPage.tsx` (871 líneas), `schema.sql` (3.893 líneas), `tours.ts` (882 líneas), tipos de BD escritos a mano (929 líneas), 4 tablas con RLS/índices/triggers para features que no existen y 4 buckets de Storage sin uso. |
| Testing | 12 archivos de test para 170 de código. Cero tests en `hooks/` y solo uno en `services/` (`query.test.ts`). |

**Prioridad recomendada:** los puntos `C1` (RLS en `public`), `C2` (RPC ejecutables por `anon`),
`C3` (credenciales de seed) y `P1`/`P2` (RLS por fila e índices trigram) concentran ~80 % del
riesgo y del coste real.

### 0.1 Estado de implementación (sesión de aplicación)

Qué se aplicó ya, con la evidencia de verificación, y qué quedó fuera a propósito. Todo lo aplicado
está en `supabase/patches/10-endurecimiento-y-rendimiento.sql` (espejo exacto de la migración
`10_endurecimiento_y_rendimiento` aplicada al proyecto).

#### Aplicado en la base de datos

| Hallazgo | Cambio aplicado | Verificación ejecutada |
| -------- | --------------- | ---------------------- |
| **C2** | Cierre de la superficie RPC: se revocó `EXECUTE` a `anon` en todas las funciones de `tribuia` salvo las 4 del flujo de registro. `apply_payment_result` sigue exclusiva de `service_role`. | Pasa de **24 a 4** funciones invocables por `anon`. `find_profile_by_email` como `anon` → `42501 permission denied`. Las 4 de registro siguen respondiendo a `anon`. |
| **P1** | 100 de 113 políticas reescritas: `auth.uid()` e `is_super_admin()` como InitPlan, y `has_role` / `is_condominium_admin` / `user_can_access_condominium` / `can_view_finance` / `can_manage_finance` / `shares_condominium` sustituidas por pertenencia a conjunto (`condominium_ids_with_role`, `user_condominium_ids`, `shared_profile_ids`). | **0 llamadas crudas restantes**, 0 expresiones con paréntesis desbalanceados, 0 dobles envolturas. Aislamiento por rol **idéntico al baseline** en 4 perfiles (tabla siguiente). |
| **P2** | 17 índices GIN trigram, una por tabla, con exactamente las columnas que declara `searchColumns` en cada servicio. | 17/17 creados y visibles en `pg_indexes`. |
| **P3** | Índices de cobertura para claves foráneas, **derivados del catálogo** (no escritos a mano). | **44 → 0** claves foráneas sin cobertura (41 índices creados; el resto quedó cubierto por índices compuestos nuevos). |
| **P3** | Baja de índices redundantes, también derivada del catálogo. | 2 eliminados (ver corrección más abajo). |
| **P8** | Vista `tribuia.buildings_with_counts` con `security_invoker = true`. | Devuelve 7 filas; con sesión de administrador, sus 5 bloques (RLS respetada). |

**Verificación de aislamiento por rol (antes → después, sin cambios):**

| Perfil | residentes | apartamentos | perfiles | condominios | miembros | notificaciones | gastos | auditoría |
| ------ | ---------: | -----------: | -------: | ----------: | -------: | -------------: | -----: | --------: |
| ADMINISTRATOR | 40 → 40 | 31 → 31 | 35 → 35 | 2 → 2 | 36 → 36 | 21 → 21 | 55 → 55 | 393 → 393 |
| OWNER | 2 → 2 | 15 → 15 | 25 → 25 | 1 → 1 | 25 → 25 | 10 → 10 | 27 → 27 | 0 → 0 |
| SUPER_ADMIN | 41 → 41 | 43 → 43 | 89 → 89 | 3 → 3 | 38 → 38 | 0 → 0 | 55 → 55 | 558 → 558 |
| Sin membresía | 0 → 0 | 0 → 0 | 1 → 1 | 0 → 0 | — | 0 → 0 | 0 → 0 | 0 → 0 |
| `anon` | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | — | 0 → 0 | — | 0 → 0 |

También se probaron **con sesión real las RPC que la app invoca** (`current_user_context`,
`condominium_dashboard_stats`, `global_search`, `invitations_for_condominium`,
`mark_all_notifications_read`, `registration_requests_for_review`, `subscription_quote`,
`expenses_by_category`, `find_profile_by_email`, `resident_dashboard`): todas responden.

> **Corrección a la sección P3:** `idx_meeting_signatures_meeting` **no** debía borrarse. Solo está
> cubierto por `uq_meeting_signatures_profile` y `uq_meeting_signatures_document`, que son índices
> **parciales** (`where profile_id is not null`). Un índice parcial no cubre a uno total, así que la
> baja se descartó sola. El análisis previo era incorrecto en ese punto; el script aplica ahora la
> comprobación correcta (`indpred is null`).

> **Bug propio detectado y corregido durante la implementación.** La bajada automática de índices
> redundantes también borró `idx_audit_logs_search`, el índice **GIN** de `audit_logs(entity)`:
> la regla solo comparaba columnas líderes, y `idx_audit_entity (entity, entity_id)` es un **btree**
> que "cubre" esa columna. Pero un btree no puede resolver `ILIKE '%...%'`, así que el índice
> trigram no era redundante: era el único que servía para la búsqueda. Se detectó al verificar que
> había 16 índices GIN en lugar de 17. La regla ahora exige que **ambos** índices sean btree
> (`pg_am.amname = 'btree'`) y se recreó el índice. Verificado: la regla corregida borra 0 y hay
> 17/17 índices GIN. Este es exactamente el motivo por el que la comprobación se hizo contra la
> base real y no solo leyendo el esquema.


#### Aplicado en el código

| Hallazgo | Archivo | Cambio |
| -------- | ------- | ------ |
| C3 | `.env.example`, `README.md`, `scripts/seed-data.ts`, `scripts/seed-users.ts` | Se eliminó `EdiFeasy2024*` de los **tres** sitios donde estaba (`.env.example`, `README` y el literal `DEFAULT_SEED_PASSWORD` de `seed-data.ts`). `npm run seed` ahora exige `SEED_DEFAULT_PASSWORD` y la valida (mínimo 12 caracteres, mayúscula, minúscula, número, símbolo y sin palabras predecibles) antes de crear nada. |
| P2 | `src/services/query.ts` | Se dejó de **borrar** el `%` del término buscado (antes se alteraba en silencio) y se exige un mínimo de 2 caracteres, igual que el buscador global. |
| P6/P8 | `src/services/buildingService.ts`, `src/types/database.ts` | `listWithCounts` usa la vista nueva: el conteo lo hace PostgreSQL. Se tipó la vista con un `ViewDef` porque `Views` estaba declarado vacío y `from('buildings_with_counts')` no compilaba. |
| F2 | `src/lib/notify.ts` | Las instancias de Ant Design se asignan desde `useLayoutEffect` con limpieza, no durante el render. |
| F3 | `src/lib/env.ts` | `isProduction` pasa a `import.meta.env.PROD` (lo determina Vite). `VITE_APP_ENV` queda como `appEnvironment`, solo informativo. |
| F4 | `src/components/ui/DataTable.tsx` | Búsqueda con retardo de 350 ms; se quitaron `onPressEnter` y `onBlur` (el `onBlur` se disparaba también al pulsar "Exportar"). |
| F6 | `src/hooks/useTableParams.ts` | `initialParams` se congela en un inicializador perezoso de `useState`; `reset` ya no necesita `eslint-disable`. |
| F7 | `src/lib/queryKeys.ts`, `src/providers/AuthProvider.tsx` | Las dos claves inline pasan a `queryKeys` (`userContext`, `superAdminCondominiums`). |
| F8 | `vite.config.ts` | `manualChunks` propios para `leaflet`, `three` y `driver.js`. |
| S1 | `src/services/storageService.ts` | El límite de tamaño es por bucket (`avatars` 2 MB, `signatures` 5 MB, resto 25 MB) en lugar de 25 MB para todo. |

#### Deliberadamente NO aplicado (y por qué)

| Hallazgo | Motivo |
| -------- | ------ |
| **C1** (RLS en `public`) | **Fuera de alcance por indicación expresa:** no se tocó nada del esquema `public`. El parche 10 no menciona ese esquema en ninguna sentencia. |
| **P4** (partir `for all` en 4 políticas) | Cambio de seguridad con riesgo real: hay que replicar el `with check` original en 18 tablas. Sin poder ejecutar las pruebas, el riesgo de abrir un agujero supera el beneficio (que ya baja al eliminar la evaluación duplicada con P1). |
| **P5** (`count: 'exact'` → `estimated`) | Cambia la semántica del total que ve el usuario y con las tablas actuales (máximo 558 filas) el coste es despreciable. |
| **P6** (RPC `reports_summary` y un solo hook) | Refactor funcional de los dashboards: 6 hooks → 1 y cambios en `reportService`. El SQL está listo en la sección P6. |
| **P7** (invalidación selectiva en Realtime) | Acotar las invalidaciones puede dejar datos sin refrescar si se olvida un caso. Necesita pruebas con Realtime activo. |
| **F1** / **F9** (dividir `ApartmentDetailPage`, descriptor único de columnas) | Refactors grandes y mecánicos, sin impacto en seguridad ni en rendimiento medido. Mejor en una rama propia. |
| **F5** (quitar el toast global de queries) | Cambia el comportamiento visible ante errores; hay que decidir qué pantallas ya pintan su propio `ErrorState`. |
| **F7 variante** (`claimMine` y el `clear()` duplicado) | Se analizó y **se decidió no tocar**: quitar `contextQuery.data` de las dependencias del efecto impediría reclamar la invitación cuando el contexto termina de cargar, y quitar el `clear()` de `signOut` deja una ventana con la caché del usuario anterior. Ambos cambios habrían degradado el flujo. |
| **B1–B5** (Edge Functions) | Requieren desplegar y probar contra Wompi. Las propuestas están en la sección 6. |
| **E1/E2** (fuente de verdad del esquema, tipos generados) | Necesitan una decisión de proceso. El parche 10 funciona con la vía actual (SQL Editor) y sirve tal cual como migración si se adopta la otra. |
| **E5** (tablas y buckets sin uso) | Borrar `meetings`, `meeting_signatures`, `reports`, `report_images` y 4 buckets afecta a objetos del proyecto compartido; requiere confirmación de producto. |

> Nota de verificación: no se ejecutó `npm run typecheck` / `lint` / `test` porque el checkout no
> tiene `node_modules`. Los cambios de TypeScript se revisaron leyendo el resultado de cada edición.



---

## 1. Inventario y arquitectura observada

### 1.1 Stack

| Capa | Tecnología |
| ---- | ---------- |
| UI | React 18.3 + TypeScript 5.6 (strict) + Vite 5 + Ant Design 5 + Tailwind 3 |
| Estado servidor | TanStack Query 5 (`queryClient` central con `onError` global) |
| Estado sesión | Context API (`AuthProvider` + `AuthContext`) |
| Formularios | react-hook-form + Zod |
| Gráficas / mapas / 3D | Recharts, Leaflet, Three.js |
| Backend | Supabase: PostgreSQL 17, Auth, Storage, Realtime, Edge Functions (Deno) |
| Pagos | Wompi vía Edge Functions `wompi-payments` + `wompi-webhook` |
| PWA | `vite-plugin-pwa` con `autoUpdate` |

### 1.2 Volumen

```
40.680 lineas totales (codigo + SQL)
 3.893  supabase/schema.sql
 3.562  supabase/migrations/20260101000000_init_schema.sql   <-- copia divergente
   929  src/types/database.ts                                  <-- escrito a mano
   882  src/config/tours.ts
   871  src/features/apartments/pages/ApartmentDetailPage.tsx
   644  supabase/seed.sql
   170  archivos en src/  (88 .tsx / 82 .ts)
    12  archivos de test + 1 setup (vitest)
```

### 1.3 Modelo de datos (`esquema tribuia`)

- **40 tablas** en la base, todas con RLS habilitado y con al menos una política (verificado en
  `pg_catalog`). `supabase/schema.sql` declara **39**: la diferencia es `tribuia.condominium_places`
  (hallazgo **E5**).
- **7 roles** en `tribuia.roles`; **49 funciones `SECURITY DEFINER`** actúan como capa de
  autorización para RLS (`has_role`, `is_super_admin`, `user_can_access_condominium`, ...).
- **Índices:** ~40 explícitos, más PK y `unique`. Sin GIN/GiST ni BRIN; sin índices parciales
  sobre `is_active`.
- **Storage:** 7 buckets declarados; todos privados salvo `avatars` (correcto). Solo **3 se usan**
  como destino de subida (hallazgo **E5.3**).
- **Realtime:** 8 tablas publicadas (`alerts`, `announcements`, `conversations`, `incidents`,
  `messages`, `notifications`, `requests`, `visitors`).
- **Extensiones disponibles:** `pgcrypto`, **`pg_trgm`**, `pg_stat_statements`, `uuid-ossp`,
  `supabase_vault`.

> `pg_trgm` ya está instalada **y no se usa**. Es exactamente la extensión que falta aprovechar
> para las búsquedas `ILIKE '%...%'` (hallazgo **P2**).

### 1.4 Convenciones detectadas (a preservar en cualquier refactor)

- Comentarios y textos de UI **en español sin tildes**; se mantiene así en este informe.
- Servicios como objetos literales (`export const xService = { ... }`), nunca clases.
- Columnas dinámicas de listado centralizadas en `src/services/query.ts` (`runList`,
  `applyListParams`). Toda tabla nueva que se liste debe pasar por ahí.
- Errores siempre traducidos con `toAppError` / `getErrorMessage`; nunca se muestran mensajes
  crudos de PostgreSQL.
- Permisos de UI en `src/constants/roles.ts` (`PERMISSIONS`); la seguridad real es RLS.


---

## 2. Hallazgos críticos (seguridad)

### C1. 13 tablas de `public` sin RLS, con datos reales de otras apps

**Evidencia** (advisor de seguridad del proyecto `pgwtfnipasabidtfgiax`):

```
rls_disabled (critical) — 13 table(s) have Row Level Security (RLS) disabled:
  public.abonos ..........   339 filas
  public.clientes ........   224 filas
  public.compra_items ....   427 filas
  public.compras .........   104 filas
  public.gastos ..........   616 filas
  public.productos .......   422 filas
  public.proveedores .....    16 filas
  public.venta_items ..... 2.077 filas
  public.ventas ..........   652 filas
  public.usuarios ........     1 fila
  ...
```

**Por qué es crítico y por qué afecta a EdiFeasy:** el frontend lleva su
`VITE_SUPABASE_ANON_KEY` en el bundle. Esa clave es del **proyecto Supabase completo**, no del
esquema `tribuia`. Cualquiera que inspeccione el bundle puede hacer
`GET /rest/v1/ventas?select=*` (o `POST`, `PATCH`, `DELETE`) y leer o destruir datos de las
otras aplicaciones que comparten la base. El `README.md` presume de convivir con otras apps en
la misma base; ese diseño hace que **el eslabón más débil determine la seguridad de todos**.

Hay además 68 tablas con RLS habilitado y **sin política** en otros esquemas (`dev`, `pos`,
`golazo`), señal de un proyecto compartido sin gobierno de esquemas.

**Refactor propuesto (decidir con el dueño del proyecto):**

1. **Corto plazo — cerrar `public`.** Si EdiFeasy va a producción en este proyecto hay que
   habilitar RLS en esas 13 tablas. Ojo: habilitar RLS sin políticas **bloquea todo acceso**, así
   que hay que acordar el SQL con cada equipo antes de ejecutarlo.
2. **Inmediato — quitar `public` de los esquemas expuestos** si nada de EdiFeasy lo usa:
   *Dashboard → Settings → API → Exposed schemas*. El frontend usa `DB_SCHEMA = 'tribuia'`
   (`src/lib/supabase.ts:12`), así que no debería romperse. **Verificar antes** que ninguna Edge
   Function ni script dependa de `public`.
3. **Mediano plazo — proyecto separado por aplicación.** Los esquemas aíslan **tablas**, no
   **claves ni buckets ni cuota de cómputo**. La razón original de usar `tribuia` era
   "convivir en una base"; conviene revisarla.

> Relacionado: `supabase/config.toml:9` declara
> `schemas = ["tribuia", "public", "storage", "graphql_public"]`. Ese archivo describe el
> entorno **local**; el proyecto remoto se revisa en el Dashboard.

### C2. 49 funciones `SECURITY DEFINER` ejecutables por `anon`

**Evidencia:**

```sql
-- 49 funciones de tribuia son ejecutables por anon
select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'tribuia' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE');
-- 49 filas
```

De esas 49, **las 25 RPC que el propio código llama** fueron verificadas una por una. El resultado
es elocuente: **24 de 25 son invocables por `anon`**, y **solo una** (`apply_payment_result`) está
correctamente cerrada:

```sql
select p.proname, p.prosecdef as sec_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'tribuia' and p.proname in (
  'add_member_by_email','apply_payment_result','approve_registration_request',
  'claim_my_invitations','complete_self_registration','condominium_dashboard_stats',
  'create_invitation','current_user_context','expenses_by_category','expenses_monthly_series',
  'find_profile_by_email','generate_admin_fees','global_search','invitations_for_condominium',
  'is_condominium_admin','mark_all_notifications_read','my_registration_request',
  'registration_apartments','registration_buildings','registration_catalog',
  'registration_requests_for_review','reject_registration_request','resident_dashboard',
  'revoke_invitation','subscription_quote'
)
order by p.proname;
```

Resumen por riesgo **de las RPC que este proyecto usa**:

| RPC | `SECURITY DEFINER` | `anon` puede | Riesgo |
| --- | :---------------- | :----------: | ------ |
| `find_profile_by_email(p_email)` | sí | **sí** | **Enumeración de cuentas**: confirma a un anónimo si un correo está registrado. Es la de mayor impacto real. |
| `registration_catalog()` | sí | sí | Expone el catálogo de condominios activos (nombre, ciudad, país). **Necesario** para el registro, es superficie pública a propósito. |
| `registration_buildings()` / `registration_apartments()` | sí | sí | Igual: necesario para el registro. |
| `complete_self_registration(...)` | sí | sí | Necesario (el usuario puede no tener sesión si la confirmación de correo está activa). Verifica `auth.uid()` internamente. |
| `create_invitation`, `add_member_by_email`, `revoke_invitation`, `approve_registration_request`, `reject_registration_request`, `invitations_for_condominium`, `registration_requests_for_review` | sí | **sí** | Mitigado: fallan con `42501` porque `is_condominium_admin()` exige `auth.uid()` con rol. Aun así son superficie expuesta sin necesidad. |
| `generate_admin_fees(...)` | sí | **sí** | Mitigado igual. Concede valor monetario: es la que conviene cerrar primero. |
| `subscription_quote(...)` | sí | sí | Solo lectura de precios. |
| `current_user_context()` | sí | sí | Devuelve **los datos del llamador**. Sin sesión, devuelve vacío. |
| `claim_my_invitations()`, `my_registration_request()` | sí | sí | Del llamador. Sin sesión, no hacen nada. |
| `is_condominium_admin(...)` | sí | sí | Predicado de autorización expuesto como endpoint público. |
| `condominium_dashboard_stats`, `resident_dashboard`, `expenses_by_category`, `expenses_monthly_series`, `global_search`, `mark_all_notifications_read` | **no** (invoker) | sí | Respetan RLS, así que `anon` no obtiene datos. Exposición innecesaria, riesgo bajo. |
| `apply_payment_result(...)` | sí | **no** | ✅ Correcto: `revoke` explícito y `grant` solo a `service_role`. |

El *lint* `anon_security_definer_function_executable` (WARN) marca exactamente esto.

> El diseño correcto **ya existe en este repo**: `supabase/patches/09-pagos.sql:350-353` hace
> `revoke all ... from public, anon, authenticated` y luego `grant execute ... to service_role`.
> El resto del esquema simplemente no siguió ese criterio.


**Refactor propuesto.** El patrón correcto ya existe en el repo:
`supabase/patches/09-pagos.sql:350-353` hace `revoke all ... from public, anon, authenticated` y
luego `grant execute ... to service_role`. Aplicar el mismo criterio de forma **sistemática**:

```sql
-- 5.9 Endurecimiento de la superficie RPC -------------------------------------
-- Por defecto nadie ejecuta nada; solo se abre lo que el frontend necesita.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'tribuia'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
  end loop;
end
$$;

-- Flujo de registro: debe funcionar antes/despues de tener sesion.
grant execute on function tribuia.registration_catalog() to anon, authenticated;
grant execute on function tribuia.registration_buildings(uuid) to anon, authenticated;
grant execute on function tribuia.registration_apartments(uuid) to anon, authenticated;
grant execute on function tribuia.complete_self_registration(uuid, uuid, uuid, text, jsonb, text)
  to authenticated;

-- Resto de la API: solo autenticados.
grant execute on function tribuia.current_user_context() to authenticated;
grant execute on function tribuia.claim_my_invitations() to authenticated;
grant execute on function tribuia.create_invitation(uuid, text, text, text, uuid) to authenticated;
grant execute on function tribuia.revoke_invitation(uuid) to authenticated;
grant execute on function tribuia.add_member_by_email(uuid, text, text, text) to authenticated;
grant execute on function tribuia.approve_registration_request(uuid, text) to authenticated;
grant execute on function tribuia.reject_registration_request(uuid, text) to authenticated;
grant execute on function tribuia.invitations_for_condominium(uuid, text) to authenticated;
grant execute on function tribuia.registration_requests_for_review(uuid, text) to authenticated;
grant execute on function tribuia.my_registration_request() to authenticated;
grant execute on function tribuia.generate_admin_fees(uuid, date, numeric, date) to authenticated;
grant execute on function tribuia.subscription_quote(uuid) to authenticated, service_role;
grant execute on function tribuia.admin_fees_summary(uuid) to authenticated;
grant execute on function tribuia.expenses_summary(uuid) to authenticated;
grant execute on function tribuia.fines_summary(uuid) to authenticated;
```

Y **eliminar `find_profile_by_email`** del API público (basta con revocarle el `EXECUTE`): la
lógica ya está duplicada dentro de `create_invitation` / `add_member_by_email`, que hacen su
propio `select` por correo. No hay razón para que el navegador pueda preguntar "¿existe este
correo?".

> Los *triggers* (`handle_new_user`, `fn_audit`, `fn_alert_notify`, ...) no deben ser invocables
> por ningún rol de API: el `revoke ... from public, anon` + no otorgar a `authenticated` los
> cubre. Verificar después que sigan disparando (los invoca el motor, no el cliente).

### C3. Credenciales de seed publicadas

`.env.example:19` y `scripts/seed-users.ts` documentan:

```dotenv
SEED_DEFAULT_PASSWORD=EdiFeasy2024*
```

Es una contraseña **predecible y versionada**. El proyecto real tiene 89 filas en
`tribuia.profiles`; si alguna vez se ejecutó `npm run seed` contra él, hay cuentas de prueba con
contraseña conocida.

**Refactor propuesto:**

1. Dejar el valor vacío en `.env.example`: `SEED_DEFAULT_PASSWORD=<define-una-clave-temporal-fuerte>`.
2. Que `scripts/seed-users.ts` aborte si la clave falta o es débil, reutilizando la filosofía de
   validación de `src/lib/env.ts`.
3. Auditar y rotar/desactivar cualquier cuenta de prueba que exista en el proyecto real.
4. Activar *Authentication → Password strength → leaked password protection* (el advisor lo
   reporta como deshabilitado).



---

## 3. Hallazgos de rendimiento (alto impacto)

### P1. Las funciones de RLS se evalúan **por fila**, no por consulta

**Evidencia** — lecturas acumuladas de índice (`pg_stat_user_indexes`) frente al tamaño real:

| Tabla | Filas | Lecturas de índice |
| ----- | ----: | -----------------: |
| `tribuia.roles` | **7** | **111.461** |
| `tribuia.user_roles` | **1** | **64.118** |
| `tribuia.condominium_members` | **38** | **62.443** |
| `tribuia.apartment_owners` | 20 | 5.433 |
| `tribuia.apartment_tenants` | 10 | 3.706 |
| `tribuia.expense_categories` | 15 | 1.770 |

Una tabla de 7 filas con 111.461 lecturas de índice solo se explica de una forma:
`tribuia.is_super_admin()` (un `join` contra `user_roles` + `roles`) se está ejecutando **una vez
por fila de cada tabla consultada**, porque aparece como primera condición dentro de casi todas
las políticas:

```sql
-- supabase/schema.sql (varias politicas)
using (tribuia.user_can_access_condominium(condominium_id));       -- llama a is_super_admin()
using (tribuia.shares_condominium(id));                            -- join de membresias por fila
using (tribuia.has_role(condominium_id, array['ADMINISTRATOR']));  -- join por fila
```

`is_super_admin(p_user uuid default auth.uid())` es `STABLE` y su argumento **es constante**
(`auth.uid()` no depende de la fila). PostgreSQL solo convierte una función `STABLE` con
argumentos constantes en *InitPlan* (evaluada **una vez por consulta**) si se la envuelve en un
subselect escalar. Sin envolverla, la evalúa por fila.

**Refactor propuesto** — envolver en `(select ...)` **solo** las funciones cuyos argumentos no
dependen de la fila:

```sql
-- profiles
drop policy if exists profiles_select on tribuia.profiles;
create policy profiles_select on tribuia.profiles for select to authenticated
  using (id = (select auth.uid()) or tribuia.shares_condominium(id));

-- roles: is_super_admin() no depende de la fila -> InitPlan
drop policy if exists roles_write on tribuia.roles;
create policy roles_write on tribuia.roles for all to authenticated
  using ((select tribuia.is_super_admin())) with check ((select tribuia.is_super_admin()));

-- user_roles
drop policy if exists user_roles_select on tribuia.user_roles;
create policy user_roles_select on tribuia.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select tribuia.is_super_admin()));

-- residents: mantener los setof dentro de "in (select ...)"
drop policy if exists residents_select on tribuia.residents;
create policy residents_select on tribuia.residents for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR','SPOKESPERSON','SECURITY'])
    or apartment_id in (select tribuia.user_apartment_ids())
  );
```

Reglas prácticas a aplicar en `schema.sql`:

- `auth.uid()` → `(select auth.uid())`.
- `tribuia.is_super_admin()` (sin argumento de fila) → `(select tribuia.is_super_admin())`.
- `user_apartment_ids()` / `user_building_ids()` / `user_condominium_ids()` → siempre dentro de
  `in (select ...)`; nunca como `= any(tribuia.user_...)`.
- `has_role(condominium_id, ...)`, `user_can_access_condominium(condominium_id)` y
  `shares_condominium(id)` **sí** dependen de la fila: no se pueden convertir en InitPlan. Ahí la
  ganancia viene de que `is_super_admin` ya no se recalcule por fila (es el primer término del
  `or`) y del índice compuesto correcto (ver P3).
- `is_super_admin` puede además acelerarse con una caché de sesión:
  ```sql
  -- Alternativa de mayor impacto: resolver el super admin desde el JWT
  -- (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') y mantener user_roles solo como respaldo.
  ```

**Cómo medir antes/después:**

```sql
select relname, seq_scan, idx_scan, n_live_tup
from pg_stat_user_tables where schemaname = 'tribuia'
order by idx_scan desc limit 10;
-- reiniciar contadores para medir en limpio:  select pg_stat_reset();
```

### P2. Búsquedas `ILIKE '%texto%'` sin índice trigram

`src/services/query.ts:52-60` construye `col.ilike.%termino%` para todas las listas. Un patrón con
`%` a la izquierda **no puede** usar un índice B-tree: PostgreSQL hace *sequential scan*.

**Evidencia:** `tribuia.residents` tiene 41 filas y **592 seq scans** (≈14 veces su tamaño), con
`idx_residents_condominium` presente pero inútil para esa consulta. Aplica igual a búsquedas sobre
`full_name`, `concept`, `plate`, `title`, `description`, `entity`...

La extensión `pg_trgm` **ya está instalada** en el proyecto y no se usa.

**Refactor propuesto:**

```sql
-- 4.2 Indices trigram para las busquedas de la UI (ILIKE '%...%') --------------
create extension if not exists "pg_trgm" with schema extensions;

create index if not exists idx_residents_search on tribuia.residents
  using gin (full_name gin_trgm_ops, document_number gin_trgm_ops, email gin_trgm_ops);
create index if not exists idx_apartments_search on tribuia.apartments
  using gin (number gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_buildings_search on tribuia.buildings
  using gin (name gin_trgm_ops, number gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_expenses_search on tribuia.expenses
  using gin (concept gin_trgm_ops, provider gin_trgm_ops, invoice_number gin_trgm_ops);
create index if not exists idx_documents_search on tribuia.documents
  using gin (title gin_trgm_ops, description gin_trgm_ops, file_name gin_trgm_ops);
create index if not exists idx_fines_search on tribuia.fines
  using gin (reason gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_requests_search on tribuia.requests
  using gin (title gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_incidents_search on tribuia.incidents
  using gin (title gin_trgm_ops, description gin_trgm_ops);
create index if not exists idx_visitors_search on tribuia.visitors
  using gin (full_name gin_trgm_ops, document_number gin_trgm_ops, plate gin_trgm_ops);
create index if not exists idx_audit_logs_search on tribuia.audit_logs
  using gin (entity gin_trgm_ops);
-- Una por entidad que declare searchColumns en su servicio.
```

**Además, dos correcciones en `buildSearchExpression` (`src/services/query.ts:47-60`):**

1. `escapeSearchTerm` hace `term.replace(/[,()%]/g, ' ')`, es decir **borra el `%` que escribe el
   usuario** y deja sin escapar los comodines `_` y `\`. Mejor:
   ```ts
   function escapeSearchTerm(term: string): string {
     // PostgREST usa `,` y `)` como separadores dentro de or(...); LIKE usa % y _ como comodines.
     return term.replace(/[,()]/g, ' ').replace(/([\\%_])/g, '\\$1').trim()
   }
   ```
2. Las búsquedas de 1 carácter cuestan igual que las de una palabra. Añadir un mínimo de 2
   caracteres en `buildSearchExpression` (el `GlobalSearch` ya lo exige en el cliente,
   `src/hooks/useDashboard.ts:43`, pero **los listados no**).


### P3. Índices: redundantes y faltantes

**Redundantes** (la columna líder ya está cubierta por otro índice; verificado con `pg_index`
comparando prefijos y con `times_used = 0` en `pg_stat_user_indexes`):

| Índice redundante | Ya cubierto por |
| ----------------- | --------------- |
| `idx_admin_fees_apartment` | `admin_fees_apartment_id_period_key (apartment_id, period)` |
| `idx_meeting_signatures_meeting` | `uq_meeting_signatures_document` (empieza por `meeting_id`) |
| `idx_vehicles_condominium` (0 usos) | `idx_vehicles_plate (condominium_id, upper(plate))` |
| `idx_alerts_created_at` (0 usos) | `idx_alerts_condominium` cubre los filtros reales |
| `idx_visitors_scheduled_at`, `idx_visitors_created_at` (0 usos) | `idx_visitors_condominium` |

**Faltantes** — `tribuia` tiene **44 claves foráneas sin índice de cobertura** (verificado con la
consulta de la sección 10.2); entre ellas:

```
condominiums_created_by_fkey, vehicles_resident_id_fkey, alerts_apartment_id_fkey,
alerts_building_id_fkey, alerts_created_by_fkey, announcements_building_id_fkey,
announcements_created_by_fkey, notifications_condominium_id_fkey,
conversations_created_by_fkey, messages_condominium_id_fkey, requests_assigned_to_fkey,
requests_building_id_fkey, request_comments_author_id_fkey, incidents_assigned_to_fkey,
documents_building_id_fkey, documents_category_id_fkey, documents_uploaded_by_fkey,
meetings_document_id_fkey, reports_created_by_fkey, registration_requests_building_id_fkey,
registration_requests_reviewed_by_fkey, condominium_invitations_* ...
```

Sin índice, un `UPDATE`/`DELETE` sobre la tabla padre obliga a un *seq scan* de la hija para
validar la FK, y los `join` por esas columnas no se pueden optimizar. Es la causa clásica de
lentitud al borrar un condominio o un bloque.

**Refactor propuesto:**

```sql
-- 4.3 Cobertura de claves foraneas --------------------------------------------
create index if not exists idx_alerts_apartment       on tribuia.alerts (apartment_id);
create index if not exists idx_alerts_building        on tribuia.alerts (building_id);
create index if not exists idx_announcements_building on tribuia.announcements (building_id);
create index if not exists idx_documents_building     on tribuia.documents (building_id);
create index if not exists idx_documents_category     on tribuia.documents (category_id);
create index if not exists idx_notifications_condo    on tribuia.notifications (condominium_id);
create index if not exists idx_messages_condo         on tribuia.messages (condominium_id);
create index if not exists idx_requests_assigned      on tribuia.requests (assigned_to);
create index if not exists idx_requests_building      on tribuia.requests (building_id);
-- ... el resto del listado del advisor (lint 0001_unindexed_foreign_keys)

-- 4.4 Limpieza de indices redundantes -----------------------------------------
drop index if exists tribuia.idx_admin_fees_apartment;
drop index if exists tribuia.idx_meeting_signatures_meeting;
drop index if exists tribuia.idx_vehicles_condominium;

-- 4.5 Indices parciales para los listados mas frecuentes ----------------------
create index if not exists idx_residents_active on tribuia.residents (condominium_id, full_name)
  where is_active;
create index if not exists idx_owners_active on tribuia.apartment_owners (profile_id, apartment_id)
  where is_active;
create index if not exists idx_tenants_active on tribuia.apartment_tenants (profile_id, apartment_id)
  where is_active;
```

> Como `schema.sql` es idempotente y el `README.md` §5 indica ejecutarlo completo, la vía natural
> es añadir estos bloques al archivo y reejecutarlo. Sobre tablas grandes conviene crear los
> índices nuevos con `create index concurrently` desde el SQL Editor para no bloquear escrituras.

### P4. Políticas permisivas duplicadas

18 tablas tienen **dos políticas permisivas para `SELECT`** (`x_select` + `x_write`, donde `write`
es `for all`). PostgreSQL evalúa **todas** las políticas permisivas aplicables y hace un `OR` de
sus predicados: el resultado es correcto, pero se paga el coste dos veces y complica el
razonamiento de seguridad. El advisor lo reporta como `multiple_permissive_policies`.

Tablas afectadas: `admin_fees`, `apartment_owners`, `apartment_tenants`, `apartments`,
`buildings`, `condominium_invitations`, `document_categories`, `expense_categories`, `expenses`,
`fines`, `pets`, `purchase_items`, `purchases`, `residents`, `roles`, `user_roles`, `vehicles`,
`visitors`.

**Refactor propuesto:** separar `for all` en las cuatro acciones explícitas e **incluir el
predicado de lectura en `for select`**:

```sql
-- Antes: dos politicas permisivas compitiendo por el mismo SELECT
--   residents_select (for select)  +  residents_write (for all)

-- Despues: una politica por accion
drop policy if exists residents_write on tribuia.residents;

create policy residents_select on tribuia.residents for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR','SPOKESPERSON','SECURITY'])
    or apartment_id in (select tribuia.user_apartment_ids())
  );
create policy residents_insert on tribuia.residents for insert to authenticated
  with check (tribuia.is_condominium_admin(condominium_id));
create policy residents_update on tribuia.residents for update to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));
create policy residents_delete on tribuia.residents for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));
```

> **Cuidado:** al partir `for all` hay que replicar *exactamente* el `with check` original. Es la
> clase de cambio donde un refactor "de estilo" abre un agujero de seguridad. Hacerlo tabla por
> tabla y validando cada rol antes de fusionar.


### P5. `count: 'exact'` en todos los listados paginados

Los 25 servicios piden el total con `{ count: 'exact' }` (`query.ts` lo consume en `runList`).
PostgREST traduce eso a `select count(*) from (...)` **sin límite**, es decir:

- el `count(*)` recorre todas las filas que pasan RLS (que a su vez re-evalúa las políticas), y
- el coste crece con el tamaño del condominio, no con el de la página.

En un condominio de 5.000 movimientos de gastos, cada cambio de página paga un conteo completo.

**Refactor propuesto:**

1. Mantener `exact` solo en la **primera** página o cuando el total cambie poco; en el resto,
   `{ count: 'estimated' }` (usa las estadísticas de `pg_class`, prácticamente gratis) o `planned`
   (respeta los filtros y evita el conteo real).
   ```ts
   // src/services/query.ts
   export interface ListOptions {
     // ...
     /** 'exact' en la pagina 1; 'estimated'/'planned' en el resto. */
     countStrategy?: 'exact' | 'planned' | 'estimated'
   }
   ```
2. Alternativa mejor cuando el volumen crezca: **paginación por cursor** (`keyset`), que además
   evita el `offset` profundo (`range` con `offset` alto obliga a leer y descartar filas).
3. `src/features/dashboard/...` y las páginas de detalle usan `limit()` sin `count`: ahí ya está
   bien resuelto.

### P6. Agregaciones hechas en JavaScript en vez de en PostgreSQL

`src/services/reportService.ts:17-61` descarga **todas** las filas y agrupa en el navegador:

```ts
async function countBy(table, column, condominiumId) {
  const { data } = await supabase.from(table).select(column).eq('condominium_id', condominiumId)
  const counts = new Map<string, number>()
  for (const row of data) {
    const value = row[column]
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([key, value]) => ({ key, label: key, value }))
}
```

Esto se invoca 5 veces (estados y tipos de `requests`, `incidents`, `fines`, `alerts`) y suma
`finesAmountByStatus`, que suma importes en JS. Dos problemas:

1. **Transferencia y memoria proporcional al total de datos**, no al número de categorías.
2. **Coherencia con el resto del backend:** ya existen RPC equivalentes sin usar —
   `tribuia.expenses_summary`, `tribuia.fines_summary`, `tribuia.admin_fees_summary` — y
   `expenseService.monthlySeries` / `byCategory` sí usan RPC (`expenses_monthly_series`,
   `expenses_by_category`). Hay **dos estilos conviviendo** para lo mismo.

**Refactor propuesto** — una única RPC de reportes, con `GROUP BY` real:

```sql
-- 5.10 Reportes agregados en la base (una llamada en vez de cinco) --------------
create or replace function tribuia.reports_summary(p_condominium uuid)
returns jsonb
language plpgsql
stable
security invoker          -- RLS del llamador sigue aplicando: no necesita DEFINER
set search_path = tribuia, public, pg_temp
as $$
declare
  result jsonb;
begin
  if not tribuia.user_can_access_condominium(p_condominium) then
    raise exception 'No autorizado para consultar este condominio' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'requests_by_status',  (select coalesce(jsonb_agg(jsonb_build_object('key', status, 'value', n)), '[]')
                            from (select status, count(*) n from tribuia.requests
                                  where condominium_id = p_condominium group by status) s),
    'requests_by_type',    (select coalesce(jsonb_agg(jsonb_build_object('key', type, 'value', n)), '[]')
                            from (select type, count(*) n from tribuia.requests
                                  where condominium_id = p_condominium group by type) s),
    'incidents_by_status', (select coalesce(jsonb_agg(jsonb_build_object('key', status, 'value', n)), '[]')
                            from (select status, count(*) n from tribuia.incidents
                                  where condominium_id = p_condominium group by status) s),
    'incidents_by_type',   (select coalesce(jsonb_agg(jsonb_build_object('key', type, 'value', n)), '[]')
                            from (select type, count(*) n from tribuia.incidents
                                  where condominium_id = p_condominium group by type) s),
    'fines_by_status',     (select coalesce(jsonb_agg(jsonb_build_object('key', status, 'value', n)), '[]')
                            from (select status, count(*) n from tribuia.fines
                                  where condominium_id = p_condominium group by status) s),
    'fines_amount',        (select coalesce(jsonb_agg(jsonb_build_object('key', status, 'value', total)), '[]')
                            from (select status, sum(amount) total from tribuia.fines
                                  where condominium_id = p_condominium group by status) s),
    'alerts_by_type',      (select coalesce(jsonb_agg(jsonb_build_object('key', type, 'value', n)), '[]')
                            from (select type, count(*) n from tribuia.alerts
                                  where condominium_id = p_condominium group by type) s)
  ) into result;

  return result;
end;
$$;
```

Y en el frontend, **un solo hook** (`useReportsSummary`) en vez de seis, con las claves de caché
ya definidas en `src/lib/queryKeys.ts` → `queryKeys.reports.*` (que hoy se usan una a una).

> Beneficio extra: seis peticiones HTTP en paralelo se convierten en una, y cada una deja de
> re-evaluar las políticas RLS sobre cientos de filas.


### P7. El dashboard dispara 8-9 consultas simultáneas

`src/features/dashboard/pages/AdminDashboard.tsx:69-76`:

```ts
const statsQuery           = useAdminDashboard(currentCondominiumId)      // RPC condominium_dashboard_stats
const monthlyQuery         = useExpensesMonthly(currentCondominiumId, 6) // RPC expenses_monthly_series
const byCategoryQuery      = useExpensesByCategory(currentCondominiumId) // RPC expenses_by_category
const requestsQuery        = useRequestsByStatus(currentCondominiumId)   // descarga TODAS las solicitudes
const incidentsQuery       = useIncidentsByType(currentCondominiumId)    // descarga TODOS los incidentes
const finesQuery           = useFinesByStatus(currentCondominiumId)      // descarga TODAS las multas
const activityQuery        = useRecentActivity(currentCondominiumId, 10) // 10 filas
const alertsQuery          = useActiveAlerts(currentCondominiumId, 5)    // 5 filas
```

`ReportsPage.tsx:39-47` dispara **nueve**. Sumado a `AuthProvider`
(`current_user_context` + `super-admin-condominiums`), la pantalla inicial de un administrador
genera 10 peticiones concurrentes contra un pool de PostgREST limitado, cada una pagando el coste
de RLS descrito en P1 y las agregaciones en cliente descritas en P6.

**Refactor propuesto:**

1. **Una sola RPC** por pantalla para todo lo que es numérico:
   `tribuia.admin_dashboard(p_condominium)` devolviendo `{ stats, monthly, by_category,
   requests_by_status, ... }`. `condominium_dashboard_stats` ya existe; basta ampliarla (o crear
   `reports_summary` de P6 y reutilizarla).
2. **Cargar por prioridad:** los `StatCard` visibles arriba primero, y los gráficos con
   `useQuery(..., { enabled: hasIntersected })` o suspense diferido.
3. **Compartir caché:** `AdminDashboard` y `ReportsPage` piden exactamente los mismos datos con
   las mismas claves (`queryKeys.reports.*`, `queryKeys.expenses.monthly`). Al unificar en una
   sola RPC con una sola clave, navegar entre ambos deja de recargar todo.
4. `src/hooks/useAlerts.ts:38-40` invalida `['alerts']`, `['notifications']` y
   `['condominiums','admin-stats']` en **cada** evento de Realtime. Con un condominio activo eso
   son tres refetch completos por alerta. Mejor: insertar el evento en la caché
   (`queryClient.setQueryData`) y dejar la invalidación para acciones del propio usuario.

### P8. `listAll` / `listWithCounts` pueden truncarse en silencio

`supabase/config.toml:11` fija `max_rows = 1000`. Ese es el comportamiento por defecto de
PostgREST: **toda** respuesta se corta en 1000 filas (o en el `limit` configurado), sin aviso ni
error.

Código afectado:

- `apartmentService.listAll(condominiumId)` — `src/services/apartmentService.ts:40-49`.
- `buildingService.listWithCounts(condominiumId)` — `src/services/buildingService.ts:37-59`, que
  descarga los apartamentos para **contarlos en JS** (`counts.get(...)`) — mismo antipatrón que P6.
- `condominiumService.listAll()` — `src/services/condominiumService.ts:19-26`.

En un conjunto de 1.500 apartamentos, el conteo por bloque saldría mal y el selector de
apartamento quedaría incompleto, **sin ningún error visible**.

**Refactor propuesto:**

1. El conteo por bloque debe venir de la base:
   ```sql
   create or replace view tribuia.buildings_with_counts
   with (security_invoker = true) as
   select b.*, (select count(*) from tribuia.apartments a where a.building_id = b.id) as apartment_count
   from tribuia.buildings b;

   grant select on tribuia.buildings_with_counts to authenticated;
   ```
   `security_invoker = true` hace que la vista respete las políticas RLS del llamador (PostgreSQL 15+).
2. Para los catálogos que sí deben traerse completos, paginar explícitamente con un helper que
   itere `range()` hasta agotar las filas, en vez de confiar en un `select` sin `limit`.
3. Aplicar el mismo patrón al `select` de `useAllApartments` (`staleTime: 120_000`), que hoy no
   declara `limit`.


---

## 4. Hallazgos de consistencia y deuda estructural

### E1. Dos fuentes de verdad del esquema que ya divergieron

| Archivo | Líneas | Estado |
| ------- | -----: | ------ |
| `supabase/schema.sql` | 3.893 | Completo: incluye los parches 01-09 (invitaciones, autoregistro, marca, visitantes, pagos). |
| `supabase/migrations/20260101000000_init_schema.sql` | 3.562 | **Copia obsoleta**: le faltan ~331 líneas (los cambios de los parches). |

El `README.md` §5 instruye ejecutar `schema.sql` en el SQL Editor, así que la migración **no se
usa** — pero sigue ahí. Si alguien hace `supabase db push` o `supabase start` (el
`supabase/config.toml` existe y declara `major_version = 15`), obtiene un esquema **anterior** y
sin las tablas `payments`, `admin_fees`, `subscriptions`, `registration_requests`,
`condominium_invitations`. Es un fallo silencioso y difícil de diagnosticar.

**Refactor propuesto (una sola opción, no ambas):**

- **A) Adoptar migraciones de verdad.** Dividir el esquema en migraciones numeradas
  (`20260101000000_esquemas_y_enums`, `..._tablas_core`, `..._rls`, `..._storage`, `..._pagos`),
  generar `types/database.ts` con `supabase gen types`, y actualizar `README.md` para que la vía
  sea `supabase db push`. Requiere trabajo inicial pero elimina la clase de problema.
- **B) Quedarse con el SQL Editor.** Entonces **borrar `supabase/migrations/`** y añadir al
  `README.md` una nota explícita de que las migraciones no se mantienen. Riesgo: se pierde el
  control de versiones del esquema.
- **En cualquier caso:** `config.toml` dice `major_version = 15` y el proyecto real es
  PostgreSQL **17.6**. Alinear.

### E2. `types/database.ts` escrito a mano (929 líneas)

El archivo declara `Refleja 1:1 supabase/schema.sql` e incluye la forma de regenerarlo. Hoy es
mantenimiento manual: **cada columna nueva en SQL hay que replicarla a mano en dos helpers
genéricos** (`InsertOf`, `UpdateOf`) y en 60+ tipos de fila. Ya hay señales de deriva: la cabecera
menciona `SupabaseClient<Database, 'tribuia'>` mientras el cliente real usa
`DbSchema = 'tribuia' as const`.

**Refactor propuesto:**

```bash
# package.json
"types:db": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema tribuia > src/types/database.ts"
"types:check": "npm run types:db && git diff --exit-code src/types/database.ts"
```

- Conservar `src/types/models.ts` **a mano** (es el valor añadido: relaciones y DTOs de la app).
- Añadir `types:check` al CI: si alguien cambia el esquema sin regenerar, el pipeline falla.
- Si se decide no usar la CLI de Supabase, al menos documentar un test que compare las columnas
  reales (`information_schema.columns`) con los tipos declarados.

### E3. `inputs` sin validar en las funciones de conversión implícita

`src/services/query.ts` define una fachada `FilterableBuilder` y hace **dos conversiones
`as unknown as`** por consulta (`applyListParams` y `runList`, líneas 66 y 111). El comentario
explica que es intencional para no usar `any`, lo cual es razonable. El problema real es otro:

- `params.filters` viene de la UI y se traduce a **nombres de columna en SQL** sin lista blanca:
  ```ts
  for (const [column, value] of Object.entries(params.filters ?? {})) {
    query = query.eq(column, value)      // `column` es texto libre
  }
  ```
  Igual en `applyListParams`: `params.sortBy ?? options.defaultSort?.column` se pasa a
  `query.order(...)` sin validar.
  PostgREST rechazará una columna inexistente con un error, así que **no es inyección SQL**, pero
  sí es una superficie innecesaria: un `sortBy` arbitrario puede forzar a PostgreSQL a ordenar por
  una columna sin índice (ordenar 50.000 filas en cada página).

**Refactor propuesto:** ampliar `ListOptions` con listas blancas y validar antes de construir:

```ts
export interface ListOptions {
  searchColumns?: string[]
  /** Columnas permitidas en params.filters. Vacio = solo las declaradas aqui. */
  filterColumns?: string[]
  /** Columnas permitidas en params.sortBy. */
  sortableColumns?: string[]
  defaultSort?: { column: string; ascending: boolean }
  dateColumn?: string
  maxPageSize?: number
}
```

Cada servicio ya declara `searchColumns`; añadir `sortableColumns`/`filterColumns` es mecánico y
convierte un fallo de rendimiento en un 400 explícito.

### E4. `.env` de 0 bytes versionado en la carpeta del proyecto

`.git` no lo sigue (`git ls-files .env` → *did not match*), así que `.gitignore` funciona. Pero el
archivo existe vacío en el checkout y puede confundir: la app arranca, `EnvGuard` muestra el
aviso de configuración y parece un bug del proyecto en lugar de un `.env` sin rellenar.

**Refactor propuesto:** borrar el `.env` vacío del checkout y dejar solo `.env.example`. El
`README.md` §4 ya explica el `cp .env.example .env`.


### E5. Funcionalidades y recursos declarados que la aplicación no usa

El esquema trae **módulos completos sin interfaz**, y el repositorio no refleja lo que hay en la
base. Todo verificado objeto por objeto.

#### E5.1 Cuatro tablas con RLS, índices y triggers para features que no existen

| Tabla | Filas | Políticas | Índices | Triggers | UI / servicio |
| ----- | ----: | --------: | ------: | -------: | ------------- |
| `tribuia.meetings` | 0 | 4 | 3 | 4 | **no existe** |
| `tribuia.meeting_signatures` | 0 | 4 | 5 | 3 | **no existe** |
| `tribuia.reports` | 0 | 4 | 3 | 3 | **no existe** |
| `tribuia.report_images` | 0 | 4 | 2 | 3 | **no existe** |

Ninguna aparece en `src/services/`, `src/hooks/` ni `src/features/`. `reports` solo coincide por
nombre con el módulo de reportes **analíticos** (`/reports`, `ReportsPage.tsx`), que no usa esa
tabla: agrega `requests`, `incidents`, `fines` y `alerts`.

Coste real de lo que no se usa: **16 políticas RLS** que PostgreSQL evalúa y mantiene, **13
índices** que se actualizan en cada escritura de su tabla, **13 triggers**, 4 tipos de fila en
`types/database.ts`, 5 funciones (`meeting_condominium`, `reports_*`, ...) y 2 buckets. Nada de eso
aporta valor hoy, y todo eso hay que mantenerlo y probarlo en cada cambio de RLS.

**Refactor propuesto:** decidir una de las dos vías, tabla por tabla:

- **Implementar** el módulo (actas de asamblea y reportes con imágenes son features plausibles del
  producto: `documents` ya existe y `signatures` ya está previsto).
- **Eliminar** si no está en la hoja de ruta:
  ```sql
  drop table if exists tribuia.report_images;
  drop table if exists tribuia.reports;
  drop table if exists tribuia.meeting_signatures;
  drop table if exists tribuia.meetings;
  ```
  Y quitar sus entradas de `types/database.ts` y del bloque de RLS de `schema.sql`. Son 0 filas:
  no hay migración de datos.

#### E5.2 `tribuia.condominium_places`: tabla huérfana

Existe en la base (0 filas, 1 política, 3 índices, 0 triggers) pero **no está declarada en
`supabase/schema.sql` ni en `supabase/migrations/`**, y **no se referencia en ningún archivo del
repositorio**:

```
grep -rn "condominium_places" .  ->  sin resultados
```

Es decir: se creó al margen del repositorio (SQL Editor, un parche no versionado o un script
descartado). Consecuencias concretas:

1. Un entorno reconstruido desde el repo **no tendrá** esa tabla, así que cualquier código futuro
   que la use fallará solo en unos entornos y no en otros.
2. Si era el respaldo de "sitios cercanos", el mapa (`NearbyPlacesCard`) hoy va directo a
   Nominatim/Overpass (`placesService.ts:56-61`), sin tocar la base.
3. Es una de las **40 vs 39** discrepancias entre la base y `schema.sql`.

**Refactor propuesto:** decidir si el directorio de lugares se cachea en la base (entonces
declararla en `schema.sql` y usarla) o se elimina (`drop table`). Mientras no se decida, debe estar
en el `00-diagnostico.sql` como objeto no versionado.

#### E5.3 Buckets declarados que nunca se usan como destino de subida

`src/lib/supabase.ts:44-52` declara 7 buckets, pero el código **solo sube a 3**. Además, la
constante `STORAGE_BUCKETS` **nunca se desreferencia** (no hay un solo `STORAGE_BUCKETS.x` en todo
`src/`): los nombres se escriben como texto literal en cada punto de uso, así que el mapa solo
sirve como tipo.

| Bucket | ¿Se sube? | Dónde se usa el literal | Objetos | Límite real |
| ------ | :-------: | ----------------------- | ------: | ---------- |
| `documents` | ✅ sí | `documentService.ts:60,82,108,126` y `RequestForm.tsx:51` | 0 | 25 MB |
| `avatars` | ✅ sí | `storageService.ts:109-110` (`uploadAvatar`) | 0 | **2 MB** |
| `incident-evidence` | ✅ sí | `IncidentForm.tsx:51` | 0 | 25 MB |
| `announcements` | ❌ **no** | — | 0 | 25 MB |
| `invoices` | ❌ **no** | — | 0 | 25 MB |
| `signatures` | ❌ **no** | — | 0 | 5 MB |
| `report-images` | ❌ **no** | — | 0 | 25 MB |

Los 4 no usados no son solo buckets vacíos: tienen **políticas de `storage.objects` activas** (una
superficie de acceso que hay que revisar y mantener sin que aporte nada) y arrastran la constante
`invoices`/`signatures`/`reportImages` de `STORAGE_BUCKETS` y sus tipos.

**Refactor propuesto:**

1. Reducir `STORAGE_BUCKETS` a lo que existe funcionalmente (`documents`, `avatars`,
   `incident-evidence`) y **usar la constante en los puntos de uso** en lugar del literal, para que
   haya un solo lugar donde esté el nombre del bucket:
   ```ts
   // src/services/documentService.ts
   const uploaded = await storageService.upload(STORAGE_BUCKETS.documents, path, input.file)

   // src/features/incidents/components/IncidentForm.tsx
   const uploader = useAttachmentUploader(condominiumId, STORAGE_BUCKETS.incidentEvidence, 'incidents')
   ```
   Nota: `RequestForm.tsx:51` sube adjuntos de solicitudes al bucket `documents` con entidad
   `'requests'`. Funciona (la ruta es `<condominio>/requests/...`), pero conviene un comentario o un
   bucket propio: hoy el nombre del bucket no dice nada sobre el contenido.
2. Borrar los 4 buckets no usados desde el Dashboard de Storage (están vacíos) y quitar sus
   políticas y sus entradas en `STORAGE_BUCKETS`.
3. Si `announcements` se va a usar (la tabla tiene `attachments jsonb` y `image_url`), usarlo de
   verdad; si no, los comunicados dependen de URLs externas sin validación.


---

## 5. Hallazgos de frontend

### F1. Componentes demasiado grandes

| Archivo | Líneas | Problema |
| ------- | -----: | -------- |
| `src/features/apartments/pages/ApartmentDetailPage.tsx` | 871 | 8 queries + 4 grupos de mutaciones + 7 formularios + timeline + 4 tablas en un solo componente. |
| `src/config/tours.ts` | 882 | Es configuración, no lógica: aceptable, pero conviene dividir por módulo. |
| `src/features/payments/pages/AdminFeesPage.tsx` | 538 | idem. |
| `src/features/expenses/pages/ExpensesPage.tsx` | 453 | idem. |
| `src/features/purchases/pages/PurchasesPage.tsx` | 406 | idem. |
| `src/components/forms/fields.tsx` | 395 | 8 componentes de campo en un archivo. |

`ApartmentDetailPage` es el caso claro: **no hay nada incorrecto**, simplemente es imposible de
leer y de probar. Refactor mecánico y sin riesgo:

```
features/apartments/
  pages/ApartmentDetailPage.tsx         (~150 lineas: carga, errores, composicion)
  components/ApartmentOverview.tsx      (Descriptions + estado)
  components/ApartmentOwnersTab.tsx
  components/ApartmentTenantsTab.tsx
  components/ApartmentResidentsTab.tsx  (residentes + vehiculos + mascotas)
  components/ApartmentTimelineTab.tsx
  components/ApartmentFinesTab.tsx
```

Beneficio colateral: cada pestaña puede cargar sus datos solo cuando se abre
(`<Tabs destroyInactiveTabPane>` + `enabled` por pestaña), lo que elimina 5 de las 8 queries
iniciales.

### F2. `notify.ts` escribe estado global durante el render

`src/lib/notify.ts:13-18`:

```ts
export function NotifyBridge(): null {
  const staticFunction = App.useApp()
  messageApi = staticFunction.message        // <-- mutacion de modulo en el cuerpo del render
  notificationApi = staticFunction.notification
  return null
}
```

Funciona hoy (el componente es trivial y estable), pero es un patrón frágil:

- En React 18 `StrictMode` el render puede ejecutarse dos veces o descartarse; escribir estado de
  módulo durante el render no está garantizado.
- Si `NotifyBridge` se desmonta, `messageApi` queda apuntando a una instancia muerta y los
  `notify.*` dejan de mostrar nada **en silencio**.
- Con `React.lazy` + Suspense el orden de montaje no es determinista.

**Refactor propuesto:**

```ts
// src/lib/notify.ts
let messageApi: MessageInstance | null = null
let notificationApi: NotificationInstance | null = null

export function NotifyBridge(): null {
  const staticFunction = App.useApp()

  useLayoutEffect(() => {
    messageApi = staticFunction.message
    notificationApi = staticFunction.notification
    return () => {
      messageApi = null
      notificationApi = null
    }
  }, [staticFunction.message, staticFunction.notification])

  return null
}
```

Alternativa a medio plazo: sustituir el puente por un `NotifyContext` consumido con un hook.
Requiere tocar los ~20 sitios que usan `notify.*`, así que no es urgente.


### F3. `isProduction` depende de una variable que puede olvidarse

`src/lib/env.ts:59` y `src/lib/logger.ts:41,48`:

```ts
export const isProduction = env.VITE_APP_ENV === 'production'
```

`VITE_APP_ENV` es una variable **manual** con `default('development')`. Si el despliegue no la
define (o la define como `staging`), entonces `logger` sigue emitiendo `warn`/`info` a la consola
en producción y los logs de depuración viajan al navegador del cliente.

**Y la app ya usa dos criterios distintos para lo mismo**: `src/main.tsx:21` decide el registro del
Service Worker con `import.meta.env.PROD` (que sí es fiable: lo determina Vite), mientras el logger
usa `VITE_APP_ENV`.

**Refactor propuesto:**

```ts
// src/lib/env.ts
/** Entorno real del bundle. Manda Vite, no una variable manual. */
export const isProduction = import.meta.env.PROD
/** Entorno declarado por el despliegue: solo para telemetria/etiquetas. */
export const appEnvironment = env.VITE_APP_ENV
```

### F4. Convención de búsqueda inconsistente entre listados y buscador global

`src/components/ui/DataTable.tsx:150-164` solo aplica la búsqueda con **Enter** o al **perder el
foco**:

```tsx
onChange={(event) => {
  setSearchValue(event.target.value)
  if (event.target.value === '') onSearch('')      // unica busqueda inmediata
}}
onPressEnter={() => onSearch(searchValue)}
onBlur={() => { if (searchValue !== (params.search ?? '')) onSearch(searchValue) }}
```

Mientras `GlobalSearch` (`src/components/layout/GlobalSearch.tsx:31-34`) sí usa *debounce* de
300 ms. Dos comportamientos distintos para la misma acción en la misma app.

**Refactor propuesto:** extraer un `useDebouncedValue` (o reutilizar el patrón de `GlobalSearch`)
y aplicarlo en `DataTable` con 300-400 ms. Elimina el "no me funciona el buscador" y permite
quitar el `onBlur` (que hoy dispara búsquedas al hacer clic en el botón de exportar).

### F5. Doble notificación de error

`src/lib/queryClient.ts:27-44` muestra un `notify.error` global para **cualquier** query o
mutación que falle, salvo `meta: { silent: true }`. Pero las páginas de detalle también pintan
`<ErrorState>` con el mismo mensaje (`ApartmentDetailPage.tsx:110-117`, `DataTable` vía `isError`).
El usuario ve un *toast* **y** un estado de error con el mismo texto.

**Refactor propuesto:** dejar el toast global **solo para mutaciones** (que no tienen dónde pintar
el error) y marcar `meta: { silent: true }` en las queries cuyas páginas ya renderizan `ErrorState`.

### F6. `useTableParams.reset` con `initialParams` obsoleto

`src/hooks/useTableParams.ts:57-62`:

```ts
const reset = useCallback(() => {
  setParams(initialParams)   // initialParams se recrea en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

El `useCallback` con dependencias vacías congela el `initialParams` del **primer render**. Hoy
funciona porque cada página pasa un literal constante. Es frágil: en cuanto una página calcule
`initial` desde una prop o un filtro guardado, `reset()` volverá a un estado equivocado en
silencio.

**Refactor propuesto:**

```ts
export function useTableParams(initial: Partial<ListParams> = {}): UseTableParamsResult {
  const [initialParams] = useState<ListParams>(() => ({
    page: 1, pageSize: 10, search: '', filters: {}, dateFrom: null, dateTo: null, ...initial,
  }))
  const [params, setParams] = useState<ListParams>(initialParams)
  const reset = useCallback(() => setParams(initialParams), [initialParams])
  // ...
}
```

Así el `eslint-disable` desaparece y `reset` es correcto para cualquier `initial`.

### F7. `AuthProvider`: claves inline y consultas repetidas

- `src/providers/AuthProvider.tsx:77` usa la clave **inline** `['user-context', userId]` mientras
  `src/lib/queryKeys.ts:5` ya define `queryKeys.userContext(userId)`. Dos lugares donde cambiar la
  clave; hoy coinciden por suerte.
- `superAdminCondominiums` (`AuthProvider.tsx:119-124`) usa otra clave inline
  `['super-admin-condominiums', userId]`. Moverla a `queryKeys`.
- `queryClient.clear()` se ejecuta **dos veces** al cerrar sesión: en `signOut`
  (`AuthProvider.tsx:190`) y de nuevo en el listener de `SIGNED_OUT` (`AuthProvider.tsx:63`).
  `clear()` cancela queries y vacía la caché completa; hacerlo dos veces en el mismo instante es
  innecesario. Dejar solo el del listener (que además cubre la expiración de token).
- `claimMine()` se lanza desde un `useEffect` que depende de `contextQuery.data`
  (`AuthProvider.tsx:92-112`). El `claimedRef` evita repetirlo, pero el efecto se re-ejecuta en
  cada cambio de `data` (y `data` cambia tras cada `invalidateQueries`). Reducir las dependencias
  a `[userId, queryClient]` y usar `contextQuery.isFetched` como guarda hace el flujo mucho más
  fácil de razonar.

### F8. Peso del bundle y carga diferida

`vite.config.ts:58-64` define `manualChunks` para `react`, `antd`, `recharts` y
`@supabase/supabase-js`, pero **no** para `three`, `leaflet` ni `driver.js`:

- `three` (≈600 KB min) entra en el chunk de autenticación. Está mitigado por el `lazy()` de
  `AuthLayout.tsx:10-12`, pero conviene un `manualChunks` propio para que cambiar `three` no
  invalide la caché de todo el bundle de login.
- `leaflet` (≈150 KB + CSS) se importa **de forma estática** en
  `src/features/dashboard/components/NearbyPlacesCard.tsx:6`, y ese componente está montado en
  todos los dashboards de administrador. El mapa está fuera del primer *viewport*: es la
  oportunidad de `lazy()` más clara del proyecto.
- `recharts` está en un chunk propio pero se importa entero (`src/components/charts/charts.tsx:3-17`)
  aunque cada pantalla use 1-2 tipos de gráfico.

**Refactor propuesto:**

```ts
manualChunks: {
  react: ['react', 'react-dom', 'react-router-dom'],
  antd: ['antd'],
  charts: ['recharts'],
  map: ['leaflet'],
  three: ['three'],
  supabase: ['@supabase/supabase-js'],
  tour: ['driver.js'],
},
```

Y extraer el mapa: `const NearbyPlacesMap = lazy(() => import('./NearbyPlacesMap'))`, montándolo
con `IntersectionObserver` o un botón "Ver mapa".

### F9. `MobileRecordList` duplica el renderizado de cada listado

`src/components/ui/DataTable.tsx:215-228` renderiza `<MobileRecordList>` en móvil y `<Table>` en
escritorio, ambos con las mismas `columns`. No hay bug, pero:

- Las `columns` de Ant Design (`render` por celda, `sorter`, `filters`) se adaptan a la fuerza a
  una tarjeta. Es una traducción de un modelo de datos a otro.
- Cada página define sus columnas a mano, con `render` que formatean importes, fechas y estados.
  Esa lógica se repite en 20+ páginas.

**Refactor propuesto:** definir las columnas **una vez** en un descriptor propio
(`{ key, label, value, sortable, format }`) y derivar de él tanto las `ColumnsType<T>` de Ant como
las tarjetas móviles, además de los `ExportColumn<T>` (que ya son un descriptor muy parecido).
Un `describeColumns()` compartido elimina 3 duplicaciones por página (tabla, móvil, export).
Es el refactor más rentable de esta sección: toca muchas páginas pero con riesgo casi nulo.


---

## 6. Hallazgos en Edge Functions y pagos

### B1. `invite-member` no deja rastro de auditoría

`supabase/functions/invite-member/index.ts:138-153` crea o reactiva una membresía con
`service_role` (bypassa RLS por diseño) y **no registra nada en `tribuia.audit_logs`**. El resto
del proyecto audita casi todo (`fn_audit` en el esquema, `authService.recordAudit`, descargas de
documentos), así que la creación de un usuario administrador es precisamente la acción que **sí**
debería quedar auditada.

**Refactor propuesto:** insertar el log al final del flujo:

```ts
await admin.from('audit_logs').insert({
  user_id: userData.user.id,          // quien invita
  condominium_id: condominiumId,
  action: invited ? 'INVITE' : 'ADD_MEMBER',
  entity: 'condominium_members',
  entity_id: member.id,
  metadata: { email, role_code: roleCode, invited },
  user_agent: req.headers.get('user-agent') ?? null,
})
```

Además, `invite-member` hace un `ilike('email', email)` sin normalizar (`index.ts:111`); el correo
ya va en `toLowerCase()` en la línea 75, pero `ilike` sin patrón es un `lower(email) = lower(...)`
que **sí** puede usar `profiles_email_key` (`unique (lower(email))`). Correcto, pero se puede
escribir `.eq('email', email)` apoyándose en el índice funcional. Detalle menor.

### B2. CORS con `*` en las Edge Functions

`invite-member/index.ts:26` y `_shared/wompi.ts` declaran
`'Access-Control-Allow-Origin': '*'`. En `wompi-webhook` es irrelevante (lo llama Wompi, sin
navegador), pero en `invite-member` y `wompi-payments` conviene restringirlo al dominio de la app.

**Refactor propuesto:** leer el origen permitido de una variable de entorno
(`ALLOWED_ORIGIN`) y reflejarlo, con `*` solo como respaldo en desarrollo.

### B3. `max_rows` mal alineado con los paginadores

`supabase/config.toml:11` fija `max_rows = 1000` y `DataTable.tsx:259` ofrece
`pageSizeOptions: ['10','20','50','100']`. Está bien, pero el límite de la API debe ser **igual o
mayor** que el `maxPageSize` del frontend (`query.ts` usa `200`). Con `1000` hay margen; el riesgo
real es P8 (`listAll` sin paginar). Documentar el límite en `README.md` y en
`supabase/README` evita que alguien lo baje y rompa los exportes de datos.

### B4. `wompi-payments` no valida que el origin sea propio

`supabase/functions/wompi-payments/index.ts:103` pasa `payload?.origin` a
`resolveRedirect(...)`, que construye la URL de retorno. Un cliente malicioso puede pedir un
checkout que redirija a **su** dominio tras pagar. El pago está verificado por checksum (no hay
riesgo de cobro indebido), pero es una redirección abierta.

**Refactor propuesto:** `resolveRedirect` debe comparar el origin recibido contra una lista blanca
(`ALLOWED_ORIGINS`) y caer al valor por defecto si no coincide.

### B5. Falta limpieza programada

`tribuia.audit_logs` (558 filas, 480 KB) y `tribuia.notifications` (315 filas) crecen sin límite
con cada login/logout/descarga y cada alerta publicada (una fila de `notifications` **por miembro
activo** del condominio, ver `schema.sql:1629-1670`). En un condominio de 400 apartamentos, cada
comunicado son 400 filas.

**Refactor propuesto:**

```sql
create extension if not exists pg_cron with schema extensions;

-- Notificaciones leidas de mas de 90 dias
select cron.schedule('purge_notifications', '0 4 * * *', $$
  delete from tribuia.notifications
  where is_read and created_at < now() - interval '90 days';
$$);

-- Auditoria de mas de 2 anos (ajustar por requisito legal)
select cron.schedule('purge_audit_logs', '0 5 * * 0', $$
  delete from tribuia.audit_logs where created_at < now() - interval '2 years';
$$);
```

Y limitar la generación de notificaciones en `fn_alert_notify` / `fn_announcement_notify`
insertando solo si el miembro no tiene ya una notificación del mismo `entity_id` sin leer.


---

## 7. Cobertura de pruebas

**Situación actual** — 12 archivos de test (+ `vitest.setup.ts`):

```
src/constants/roles.test.ts
src/lib/errors.test.ts
src/services/query.test.ts
src/schemas/schemas.test.ts
src/utils/export.test.ts
src/components/routing/guards.test.tsx
src/components/tour/TourButton.test.tsx
src/components/ui/DataTable.responsive.test.tsx
src/features/approvals/ApprovalsPage.test.tsx
src/features/auth/pages/LoginPage.test.tsx
src/features/misc/NoCondominiumPage.test.tsx
src/features/users/InvitationsPanel.test.tsx
```

Lo probado es lo correcto (utilidades puras, guards, un par de pantallas) y el proyecto tiene
`vitest.setup.ts`, `src/test/test-utils.tsx` y scripts `test` / `typecheck` / `lint` / `deadcode`.
El hueco está donde vive la lógica de negocio: **`services/` (25 archivos) y `hooks/` (26) no
tienen ni un test**, y son los que traducen `ListParams` a consultas y deciden invalidaciones.

**Refactor propuesto (los de mayor retorno primero):**

1. `services/query.test.ts` ya existe: ampliarlo para cubrir
   `applyListParams` con la lista blanca de E3, el escape de P2 y los límites de `pageSize`.
2. Un test por servicio que valide **el contrato de la consulta**, no la base: mockear
   `supabase.from` y comprobar las llamadas (`.select`, `.eq`, `.or`, `.range`). Detecta
   regresiones del tipo "se cambió `condominium_id` por `condo_id`".
3. Un test por hook de mutación que verifique qué claves se invalidan. Es exactamente el tipo de
   error que provoca "guardé y no se refrescó la lista".
4. Los flujos con reglas de negocio (aprobación de registro, invitaciones, cuotas de
   administración) merecen pruebas de integración contra `supabase start` local.
5. Añadir el CI mínimo: `pnpm typecheck && pnpm lint && pnpm test`.

---

## 8. Hallazgo menor: límite de tamaño de `avatars` incoherente

`src/services/storageService.ts:12` valida **25 MB** para todos los archivos, pero el bucket real
lo limita a **2 MB** (valores leídos de `storage.buckets`, ver también **E5.3**):

| Bucket | `public` | `file_size_limit` | ¿El código lo sube? |
| ------ | :------: | ----------------: | :-----------------: |
| `avatars` | true | **2 MB** | ✅ |
| `documents` | false | 25 MB | ✅ |
| `incident-evidence` | false | 25 MB | ✅ |
| `announcements` | false | 25 MB | ❌ |
| `invoices` | false | 25 MB | ❌ |
| `report-images` | false | 25 MB | ❌ |
| `signatures` | false | 5 MB | ❌ |

`uploadAvatar` (`storageService.ts:105-112`) llama al mismo `upload()` → el usuario ve "Subir foto
de perfil" y, si el archivo pesa entre 2 y 25 MB, la app **acepta** la validación y Storage
**rechaza** con un error opaco de bucket.

**Refactor propuesto:** que el límite sea por bucket y provenga de la misma fuente de verdad:

```ts
/** Limite real de cada bucket en Supabase Storage (debe coincidir con la definicion). */
const BUCKET_MAX_SIZE: Record<StorageBucket, number> = {
  avatars: 2 * 1024 * 1024,
  signatures: 5 * 1024 * 1024,
  documents: 25 * 1024 * 1024,
  incidentEvidence: 25 * 1024 * 1024,
  invoices: 25 * 1024 * 1024,
  announcements: 25 * 1024 * 1024,
  reportImages: 25 * 1024 * 1024,
}

function validateFile(bucket: StorageBucket, file: File): void {
  const max = BUCKET_MAX_SIZE[bucket]
  if (file.size > max) {
    throw toAppError({ message: `El archivo supera el limite de ${Math.round(max / 1024 / 1024)} MB.` })
  }
  // ...
}
```

Alternativa mejor: subir `avatars` a 5 MB en Supabase y bajar el límite de `signatures` a 2 MB en
el bucket (una firma PNG no llega a 5 MB). Lo importante es que **el número esté en un solo lugar**.


---

## 9. Plan de acción propuesto

### Fase 0 — Verificaciones previas (sin cambios de código)

- [ ] Confirmar que nada de EdiFeasy depende del esquema `public` antes de retirarlo de la API.
- [ ] Ejecutar `npm run check` (`scripts/check-supabase.ts`) y el diagnóstico
      `supabase/patches/00-diagnostico.sql` contra el proyecto real y guardar la salida.
- [ ] Reiniciar estadísticas (`select pg_stat_reset()`) para poder medir la fase 2.

### Fase 1 — Seguridad (días 1-3, sin riesgo funcional)

| # | Acción | Archivo afectado |
| - | ------ | ---------------- |
| 1 | Retirar `public` de *Exposed schemas* + acordar RLS en las 13 tablas de `public` | Dashboard de Supabase |
| 2 | Bloque de `revoke/grant` sobre las RPC; sacar `find_profile_by_email` del API | `supabase/schema.sql` |
| 3 | `resolveRedirect` con lista blanca de orígenes | `supabase/functions/_shared/wompi.ts` |
| 4 | Auditoría en `invite-member` | `supabase/functions/invite-member/index.ts` |
| 5 | Rotar la contraseña de seed; limpiar cuentas de prueba; activar *leaked password protection* | `.env.example`, `scripts/seed-users.ts`, Dashboard |
| 6 | CORS restringido en las Edge Functions | `supabase/functions/*` |

### Fase 2 — Rendimiento de base de datos (semana 1-2, medible)

| # | Acción | Impacto esperado |
| - | ------ | ---------------- |
| 1 | `(select ...)` en las políticas con argumentos constantes (P1) | Caída drástica de `idx_scan` en `roles` / `user_roles` / `condominium_members` |
| 2 | Índices trigram + mínimo de 2 caracteres (P2) | Elimina los *seq scans* de búsqueda |
| 3 | Índices de FK faltantes + limpieza de redundantes (P3) | Borrados de condominio/bloque y joins |
| 4 | Índices parciales `where is_active` (P3) | Listados de residentes/propietarios |
| 5 | `count: 'estimated'` a partir de la página 2 (P5) | Paginación en tablas grandes |
| 6 | RPC `reports_summary` y un solo hook (P6) | 6 peticiones → 1 |
| 7 | Vista `buildings_with_counts` con `security_invoker` (P8) | Correctitud + 1 petición menos |
| 8 | `pg_cron` para purgas (B5) | Evita crecimiento sin límite |

### Fase 3 — Consistencia del repositorio (semana 2-3)

- [ ] Decidir E1 (migraciones reales **o** borrar `supabase/migrations/`). Bloquea el resto.
- [ ] Alinear `supabase/config.toml` a PostgreSQL 17.
- [ ] `types:db` + `types:check` en `package.json` y en el CI (E2).
- [ ] Listas blancas de filtros/orden en `ListOptions` (E3).
- [ ] Eliminar el `.env` vacío del checkout (E4).
- [ ] Decidir E5: implementar o borrar `meetings`, `meeting_signatures`, `reports`, `report_images`;
      resolver `condominium_places`; limpiar los 4 buckets sin uso.

### Fase 4 — Frontend (semanas 3-5, incremental)

- [ ] Dividir `ApartmentDetailPage` y cargar por pestaña (F1).
- [ ] `useDebouncedValue` en `DataTable` (F4).
- [ ] Unificar la notificación de error (F5).
- [ ] `notify` sin efectos en el render (F2) e `isProduction` con `import.meta.env.PROD` (F3).
- [ ] `useTableParams.reset` sin `eslint-disable` (F6).
- [ ] Claves de `AuthProvider` en `queryKeys` + quitar el `clear()` duplicado (F7).
- [ ] `manualChunks` + `lazy()` del mapa (F8).
- [ ] Descriptor único de columnas: tabla + móvil + export (F9).

### Fase 5 — Calidad continua (permanente)

- [ ] Tests de `services/` y `hooks/` (§7).
- [ ] CI: `typecheck` + `lint` + `test` + `deadcode` (knip ya está configurado).
- [ ] Revisar los advisors de Supabase en cada *release*.
- [ ] Impedir `npm run seed` contra producción con una comprobación de entorno.
---

## 10. Anexo

### 10.1 Tabla resumen por severidad

| ID | Hallazgo | Severidad | Esfuerzo |
| -- | -------- | --------- | -------- |
| C1 | 13 tablas de `public` sin RLS en un proyecto compartido | Crítica | Bajo (config) |
| C2 | 49 funciones `SECURITY DEFINER` ejecutables por `anon` | Alta | Bajo |
| C3 | Contraseña de seed publicada y versionada | Alta | Bajo |
| P1 | Funciones de RLS evaluadas por fila | Alta | Medio |
| P2 | `ILIKE '%...%'` sin índice trigram | Alta | Medio |
| P3 | 44 FKs sin índice + índices redundantes | Alta | Bajo |
| P4 | Políticas permisivas duplicadas en 18 tablas | Media | Medio |
| P5 | `count: 'exact'` en todos los listados | Media | Bajo |
| P6 | Agregaciones en JavaScript | Media | Medio |
| P7 | 8-9 consultas por pantalla de dashboard | Media | Medio |
| P8 | `listAll` puede truncarse en 1.000 filas | Media | Bajo |
| E1 | `schema.sql` vs `migrations/` divergentes | Media | Alto |
| E2 | `types/database.ts` a mano | Media | Bajo |
| E3 | Filtros y orden sin lista blanca | Media | Bajo |
| E4 | `.env` vacío en el checkout | Baja | Trivial |
| E5 | 4 tablas de features inexistentes + `condominium_places` huérfana + 4 buckets sin uso | Media | Medio |
| F1 | `ApartmentDetailPage` de 871 líneas | Media | Medio |
| F2 | `notify` con efectos en el render | Media | Bajo |
| F3 | `isProduction` desde variable manual | Media | Bajo |
| F4 | Búsqueda inconsistente en listados | Baja | Bajo |
| F5 | Doble notificación de error | Baja | Bajo |
| F6 | `useTableParams.reset` obsoleto | Baja | Trivial |
| F7 | Claves inline y `clear()` duplicado | Baja | Bajo |
| F8 | Chunks y carga diferida del bundle | Media | Bajo |
| F9 | Columnas triplicadas por página | Media | Medio |
| B1 | `invite-member` sin auditoría | Media | Bajo |
| B2 | CORS `*` en Edge Functions | Media | Bajo |
| B3 | `max_rows` no documentado | Baja | Trivial |
| B4 | Redirect de Wompi sin lista blanca | Media | Bajo |
| B5 | Sin purga de `notifications` / `audit_logs` | Media | Bajo |
| T1 | Sin tests en `services/` y `hooks/` | Media | Alto |
| S1 | Límite de `avatars` incoherente (2 MB vs 25 MB) | Baja | Trivial |

### 10.2 Consultas de verificación

```sql
-- 1. Tablas de tribuia sin RLS o sin politicas (debe salir vacio)
select c.relname, c.relrowsecurity, coalesce(p.n, 0) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'tribuia'
left join (select tablename, count(*) n from pg_policies
           where schemaname = 'tribuia' group by 1) p on p.tablename = c.relname
where c.relkind = 'r' and (c.relrowsecurity is false or coalesce(p.n, 0) = 0);

-- 2. Tablas con mas seq scans que filas (candidatas a indice)
select relname, seq_scan, n_live_tup
from pg_stat_user_tables
where schemaname = 'tribuia' and n_live_tup > 0 and seq_scan > n_live_tup
order by seq_scan desc;

-- 3. Uso real de cada indice (idx_scan = 0 tras un ciclo de uso => candidato a borrar)
select relname as table_name, indexrelname, idx_scan
from pg_stat_user_indexes
where schemaname = 'tribuia' and idx_scan = 0
order by relname;

-- 4. Funciones SECURITY DEFINER alcanzables por anon (debe quedar casi vacio)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'tribuia' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;

-- 5. Politicas permisivas duplicadas por accion
select tablename, count(*) filter (where cmd in ('SELECT','ALL')) as select_policies,
       string_agg(policyname || ' [' || cmd || ']', ', ' order by policyname) as policies
from pg_policies where schemaname = 'tribuia'
group by tablename
having count(*) filter (where cmd in ('SELECT','ALL')) > 1
order by 1;
```

> Para el advisor completo (FKs sin índice, RLS sin política, políticas duplicadas) usar
> *Dashboard → Database → Advisors → Performance / Security*: su salida no se puede reproducir
> con una sola consulta.

### 10.3 Verificación del frontend (ya disponible en el repo)

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run test          # vitest run
npm run deadcode      # knip (exports y archivos sin usar)
npm run responsive    # scripts/responsive-check.mjs
npm run check         # scripts/check-supabase.ts
npm run verify:plan   # scripts/verify-plan.mjs
```

### 10.4 Lo que NO conviene cambiar

Estas decisiones del proyecto están bien y cualquier refactor debería respetarlas:

1. **RLS como única fuente de verdad.** `src/constants/roles.ts` avisa explícitamente de que los
   permisos de UI son cosméticos. Mantenerlo.
2. **Esquema `tribuia` separado de `public`.** Lo que hay que revisar es el *proyecto* compartido,
   no el nombre del esquema.
3. **`security definer` + `set search_path` en todas las helpers.** Es la mitigación correcta
   frente a *search_path hijacking*.
4. **`runList` centralizado.** Un solo lugar donde arreglar paginación, orden y búsqueda.
5. **Edge Functions para lo privilegiado.** La service role nunca llega al navegador, los importes
   se calculan en el servidor y `apply_payment_result` tiene `revoke` explícito.
6. **PWA con `autoUpdate` y `cleanupOutdatedCaches`.** Correcto y ya probado en móvil.
7. **Code splitting de todas las páginas de módulo** (`routes/index.tsx`). Auth carga inmediata
   (es la primera pantalla) y el resto con `lazy()`: es el criterio correcto.

---

*Informe generado a partir del estado del repositorio y de la base de datos en la fecha indicada.
Las cifras de `pg_stat_*` son acumuladas desde el último `pg_stat_reset()` del proyecto, no de una
ventana temporal concreta: sirven para identificar patrones (RLS evaluado por fila, búsquedas sin
índice), no como métrica exacta de carga. Los bloques SQL propuestos son orientativos y están
escritos para revisarse antes de ejecutarse.*




