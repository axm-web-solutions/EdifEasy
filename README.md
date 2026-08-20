# EdiFeasy

Plataforma SaaS multi-tenant para la administracion de **condominios, edificios y conjuntos residenciales**.

React + TypeScript + Vite + Ant Design + Tailwind CSS en el frontend.
Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) en el backend.

El aislamiento entre condominios se aplica **en PostgreSQL con Row Level Security**, no en el frontend.

> **Esquema de base de datos:** todo el modelo vive en el esquema **`tribuia`**, no en `public`,
> para poder convivir con otras aplicaciones en la misma base. Esto exige un paso extra de
> configuracion (exponer el esquema en la API); ver [paso 5](#5-ejecutar-el-esquema).
> El nombre esta centralizado en `DB_SCHEMA` (`src/lib/supabase.ts`).

---

## Documentacion

Dos guias en `docs/`, cada una en HTML autocontenido (un solo archivo, sin internet ni
dependencias) y en PDF ya generado:

| Guia | Que cubre |
| ---- | --------- |
| [`docs/guia-del-sistema.html`](docs/guia-del-sistema.html) · [PDF](docs/guia-del-sistema.pdf) | Guia funcional: roles, flujos de acceso, modulos, seguridad, puesta en marcha, recetas de operacion y solucion de problemas. |
| [`docs/guia-de-uso.html`](docs/guia-de-uso.html) · [PDF](docs/guia-de-uso.pdf) | Guia de uso **con capturas reales** de la aplicacion: entrar, registrarse, recorrido por los modulos, uso en telefono y mensajes de error. |

### Regenerarlas

```bash
npm run dev          # terminal 1
npm run screenshots  # terminal 2 - captura docs/img/ con Chrome headless
npm run guide        # reconstruye el HTML e imprime los dos PDF
```

`npm run guide` incrusta las capturas de `docs/img/` en la plantilla
[`docs/guia-de-uso.src.html`](docs/guia-de-uso.src.html) como data URI, y despues imprime a PDF con
el Chrome o Edge ya instalado. **Editar la plantilla, no el HTML generado.**

Notas sobre las capturas:

- `npm run screenshots` emula dispositivos reales (1440 px escritorio, 768 px tableta, 390 px
  telefono) por el protocolo DevTools. Las de escritorio se guardan en **JPEG** porque incluyen la
  ilustracion del panel de acceso, un degradado grande: en PNG las cuatro capturas engordaban la
  guia de 1,8 a 5,7 MB. Las de movil y tableta siguen en PNG, que con interfaz plana pesa menos. No usa `--window-size`, porque headless Chrome impone un
  ancho minimo de ventana de 500 px y recorta la imagen: el resultado parece contenido cortado
  cuando la pagina nunca se maqueto como movil.
- Si una vista protegida redirige a `/login`, la captura **no se guarda** y el script lo informa.
  Asi la guia no muestra una pantalla de acceso haciendose pasar por un modulo.
- Las vistas internas requieren sesion con membresia ACTIVA. Mientras no exista un usuario con
  acceso, la guia marca esos huecos como «Captura pendiente» en lugar de dejarlos en blanco.

---

## 1. Requisitos

| Herramienta | Version minima |
| ----------- | -------------- |
| Node.js     | 20 (probado en 22) |
| npm         | 10             |
| Cuenta Supabase | Plan gratuito es suficiente |

Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) si prefieres usar migraciones en vez del SQL Editor.

---

## 2. Instalacion

```bash
git clone <tu-repositorio> edifeasy
cd edifeasy
npm install
```

---

## 3. Crear el proyecto en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y crea un proyecto nuevo.
2. Elige una region cercana y guarda la contrasena de la base de datos.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key
   - `service_role` key (solo para el script de seed, **nunca** para el frontend)

---

## 4. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```dotenv
# Frontend (publicas)
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_SENTRY_DSN=
VITE_APP_NAME=EdiFeasy
VITE_APP_ENV=development

# Solo para `npm run seed` (Node, nunca el navegador)
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SEED_DEFAULT_PASSWORD=EdiFeasy2024*
```

> Si faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`, la aplicacion muestra una pantalla
> de configuracion con instrucciones en lugar de fallar con errores de red.

---

## 5. Ejecutar el esquema

### 5.1 Correr el SQL

En el Dashboard de Supabase: **SQL Editor → New query**, pega el contenido completo de
[`supabase/schema.sql`](supabase/schema.sql) y ejecuta.

Ese unico archivo crea (todo dentro del esquema `tribuia`):

- El esquema `tribuia` y sus permisos
- 27 tipos ENUM
- 34 tablas con UUID como llave primaria, `created_at` y `updated_at`
- 63 indices
- 51 funciones (incluidas todas las que usa RLS)
- Triggers de `updated_at`, auditoria, notificaciones, totales de compras y codigos consecutivos
- RLS habilitado en **las 34 tablas**, con 104 politicas
- Buckets de Storage y sus politicas
- Publicacion de Realtime
- El catalogo de los 7 roles del sistema

Es **idempotente**: puedes volver a ejecutarlo sin romper nada.

### 5.2 Exponer el esquema en la API — PASO OBLIGATORIO

PostgREST solo publica los esquemas que estan en la lista blanca. Por defecto solo esta `public`.

**Settings → API → API Settings → Exposed schemas** → agrega **`tribuia`** → *Save*.

En la UI nueva puede aparecer como **Settings → Data API → Exposed schemas**.

Si te saltas este paso, cada peticion devolvera:

```
The schema must be one of the following: public, graphql_public
```

Opcionalmente agrega `tribuia` tambien a **Extra search path** (no es obligatorio: todas las
funciones del proyecto declaran su propio `search_path`).

### 5.3 Verificar

En **Database → Tables**, cambia el selector de esquema a **`tribuia`**: deben aparecer las
34 tablas.

Mejor aun, desde el repositorio:

```bash
npm run check
```

Compara `schema.sql` contra la base real y reporta exactamente que falta: tablas, funciones RPC,
exposicion del esquema, estado de Auth y si hay condominios activos. No imprime ninguna clave.

> Alternativa con CLI: `supabase db push` usando `supabase/migrations/20260101000000_init_schema.sql`.

### 5.4 Parches para bases ya desplegadas

`create table if not exists` no modifica tablas que ya existen, asi que una base creada con una
version anterior del esquema puede quedar desalineada. `npm run check` lo detecta. En
[`supabase/patches/`](supabase/patches/) hay parches idempotentes:

| Parche | Cuando ejecutarlo |
| ------ | ----------------- |
| `00-diagnostico.sql` | **Empieza por aqui.** Solo lee: dice que objetos faltan, que parche los crea y cuantos condominios/bloques/apartamentos hay |
| `01-autoregistro-con-aprobacion.sql` | Si faltan las funciones de autoregistro o el `unique` de `residents` |
| `02-bootstrap-condominio.sql` | Si `npm run check` dice "No hay condominios ACTIVOS" |
| `03-invitaciones.sql` | Si falta la tabla `condominium_invitations` o las funciones de invitaciones |
| `04-perfiles-huerfanos.sql` | Si al entrar con una cuenta que ya existia sale `23503 ... registration_requests_profile_id_fkey`: hay cuentas en `auth.users` sin fila en `tribuia.profiles` porque se crearon antes de instalar el trigger |
| `05-promover-administrador.sql` | Para tener un administrador **sin** `npm run seed` (que exige clave secreta). Convierte una cuenta existente en SUPER_ADMIN y le crea la membresia ADMINISTRATOR |
| `06-usuarios.sql` | Crea las 12 cuentas de prueba con contrasena conocida y elimina las sobrantes. Sustituye a `npm run seed` cuando no hay clave secreta |

Cada parche termina con `notify pgrst, 'reload schema';`. Sin ese aviso, PostgREST puede seguir
respondiendo `PGRST202` — que el frontend muestra como *«Falta una funcion en la base de datos»* —
durante un rato aunque la funcion ya exista.

> **El SQL Editor de Supabase ejecuta cada pestana como UNA transaccion.** Si una sola sentencia
> falla, se deshace todo lo demas de esa ejecucion, aunque el resto fuera correcto. Por eso una base
> puede quedarse con las tablas de una version antigua y sin las funciones nuevas: la ejecucion
> nueva fallaba y volvia atras. Ejecuta los parches de uno en uno y lee el mensaje de error.

---

## 6. Ejecutar el seed

El seed tiene dos pasos porque los usuarios viven en `auth.users` (Supabase Auth) y no se
pueden crear con SQL plano de forma segura.

**Paso 1 — crear los usuarios de Auth** (usa la Admin API desde Node):

```bash
npm run seed
```

**Paso 2 — crear los datos de dominio**: ejecuta [`supabase/seed.sql`](supabase/seed.sql)
en el SQL Editor.

Resultado: 1 condominio, 3 bloques, 15 apartamentos, propietarios, arrendatarios, residentes,
vehiculos, mascotas, alertas, comunicados, solicitudes, incidentes, gastos, compras, multas,
documentos y conversaciones.

### Credenciales de prueba

Son **12 cuentas** que cubren los 7 roles. Contrasena para todas: `EdiFeasy2024*`
(o el valor de `SEED_DEFAULT_PASSWORD` si usas `npm run seed`).

| Correo | Nombre | Rol |
| ------ | ------ | --- |
| `superadmin@edifeasy.com` | Sofia Nunez | SUPER_ADMIN |
| `admin@edifeasy.com` | Carlos Mejia | ADMINISTRATOR |
| `vocero@edifeasy.com` | Laura Cardenas | SPOKESPERSON |
| `celador1@edifeasy.com` | Jose Pineda | SECURITY (turno dia) |
| `celador2@edifeasy.com` | Marta Quintero | SECURITY (turno noche) |
| `servicios1@edifeasy.com` | Andres Rojas | SERVICE_STAFF (mantenimiento) |
| `servicios2@edifeasy.com` | Diana Salazar | SERVICE_STAFF (aseo) |
| `propietario1@edifeasy.com` | Propietario 1 Restrepo | OWNER |
| `propietario2@edifeasy.com` | Propietario 2 Restrepo | OWNER |
| `propietario3@edifeasy.com` | Propietario 3 Restrepo | OWNER |
| `arrendatario1@edifeasy.com` | Arrendatario 1 Gomez | TENANT |
| `arrendatario2@edifeasy.com` | Arrendatario 2 Gomez | TENANT |

Dos formas de crearlas, ambas con el mismo catalogo
([`scripts/seed-data.ts`](scripts/seed-data.ts)):

- **`supabase/patches/06-usuarios.sql`** en el SQL Editor. No necesita clave secreta y ademas
  reescribe la contrasena de las cuentas que ya existan, para que esta tabla sea exacta.
- **`npm run seed`**, que usa la Admin API de Auth y exige `SUPABASE_SERVICE_ROLE_KEY` valida.

> **Estas credenciales son publicas** (estan en este repositorio). Sirven para un entorno de
> pruebas. Si siembras estos usuarios en la base de una instalacion real, cambia la contrasena
> en `06-usuarios.sql` antes de ejecutarlo.

> Con 3 propietarios y 2 arrendatarios, el condominio demo deja **10 apartamentos libres**: son los
> que permiten probar el autoregistro. Con el catalogo anterior (12 y 5) los 15 quedaban ocupados y
> no se podia solicitar ninguno.

> Los 6 documentos del seed son **metadatos**: las filas existen en `documents` pero los archivos
> no estan en Storage. Descargarlos mostrara "El archivo solicitado no existe en el almacenamiento"
> hasta que subas un archivo real desde la pantalla de Documentos.

---

## 7. Autoregistro con aprobacion del administrador

Un residente puede crear su propia cuenta, pero **no obtiene acceso hasta que un
`ADMINISTRATOR` del condominio lo aprueba**.

### Como funciona

```
/register
  1. El usuario elige de LISTAS (nunca escribe texto libre):
       Condominio ACTIVO -> Edificio ACTIVO -> Apartamento existente
     Los apartamentos ya reclamados o con solicitud en curso salen deshabilitados.
  2. Elige su tipo: propietario, arrendatario o ambos.
     Los roles administrativos NO son autoregistrables.
  3. Se crea la cuenta en Auth y una solicitud en estado PENDING.
     La solicitud NO otorga ninguna membresia: RLS le sigue negando todo.

/sin-condominio
  El usuario ve el estado de su solicitud. Puede corregirla y reenviarla.

/approvals   (solo ADMINISTRATOR)
  Ve nombre, correo, telefono, documento, apartamento, vehiculos y mensaje.
  - Aprobar  -> crea membresia ACTIVA + propietario/arrendatario + residente
                + vehiculos, marca el apartamento OCCUPIED y notifica al usuario.
  - Rechazar -> exige un motivo, que se le envia al usuario como notificacion.
```

### Por que es seguro

- El acceso depende de `condominium_members.status = 'ACTIVE'`, y esa fila **solo**
  la crea `approve_registration_request`, que valida `is_condominium_admin()`.
  Mientras la solicitud este en PENDING, `user_can_access_condominium()` devuelve
  `false` y RLS no le muestra ni un registro.
- Los tres selectores viajan como **UUID validados contra la base**, no como
  texto. `complete_self_registration` vuelve a comprobar en PostgreSQL que el
  edificio pertenezca al condominio y el apartamento al edificio.
- `complete_self_registration` rechaza cualquier rol distinto de `OWNER`,
  `TENANT` o `BOTH`, incluso si se llama directamente a la API.
- Un indice unico parcial (`profile_id`, `condominium_id`) `where status = 'PENDING'`
  impide acumular solicitudes duplicadas; reenviar actualiza la existente.
- Dos personas no pueden reclamar el mismo apartamento: se valida contra
  `apartment_owners`, `apartment_tenants` y las solicitudes PENDING.
- El listado del administrador usa un RPC `SECURITY DEFINER`, porque el
  solicitante todavia no comparte condominio y las politicas de `profiles` no le
  permitirian ver su nombre ni su correo.

### Tabla y funciones

`tribuia.registration_requests` con RLS: el solicitante ve solo la suya, el
administrador las de su condominio.

| Funcion | Rol que la usa | Para que |
| ------- | -------------- | -------- |
| `registration_catalog()` | anon | Condominios ACTIVOS |
| `registration_buildings(uuid)` | anon | Edificios ACTIVOS del condominio |
| `registration_apartments(uuid)` | anon | Apartamentos del edificio + si estan reclamados |
| `complete_self_registration(...)` | authenticated | Crea la solicitud PENDING |
| `my_registration_request()` | authenticated | Estado de la solicitud propia |
| `registration_requests_for_review(uuid, text)` | ADMINISTRATOR | Bandeja de revision |
| `approve_registration_request(uuid, text)` | ADMINISTRATOR | Concede el acceso |
| `reject_registration_request(uuid, text)` | ADMINISTRATOR | Rechaza con motivo |

> Nota de diseno: la aprobacion aplica a **propietarios y arrendatarios por igual**.
> Un arrendatario reclamando un apartamento es igual de sensible que un propietario.
> Si quieres que los arrendatarios entren sin revision, es un `if` en
> `complete_self_registration`.

---

## 8. Ejecutar el frontend

```bash
npm run dev
```

Abre <http://localhost:5173> e inicia sesion con cualquiera de las credenciales anteriores.

---

## 9. Storage buckets

`supabase/schema.sql` los crea automaticamente:

| Bucket | Publico | Limite | Uso |
| ------ | ------- | ------ | --- |
| `documents` | No | 25 MB | Reglamentos, actas, manuales |
| `avatars` | Si | 2 MB | Fotos de perfil |
| `incident-evidence` | No | 25 MB | Evidencias de incidentes |
| `invoices` | No | 25 MB | Facturas de gastos y compras |
| `announcements` | No | 25 MB | Adjuntos de comunicados |

**Convencion de rutas** (la RLS de Storage depende de ella):

```
<condominium_id>/<entidad>/<timestamp>-<nombre-archivo>   # buckets privados
<user_id>/avatar-<timestamp>.<ext>                        # bucket avatars
```

Si tu rol de base de datos no puede crear politicas sobre `storage.objects`, el script emite un
`NOTICE` en vez de fallar. En ese caso crea las politicas desde **Storage → Policies** replicando
las del bloque 8 de `schema.sql`.

---

## 10. Configurar Auth

En **Authentication → Providers → Email**:

- Habilita *Email*.
- Para probar rapido, desactiva *Confirm email* (el script de seed ya confirma los correos).

En **Authentication → URL Configuration**:

- `Site URL`: `http://localhost:5173` (y tu dominio de Vercel en produccion)
- `Redirect URLs`: agrega `http://localhost:5173/reset-password` y `https://tu-dominio.vercel.app/reset-password`

El trigger `on_auth_user_created` crea el perfil en `public.profiles` automaticamente al registrarse.

---

## 11. Realtime

`schema.sql` agrega a la publicacion `supabase_realtime` las tablas `alerts`, `notifications`,
`messages`, `conversations`, `requests`, `incidents` y `announcements`, con `replica identity full`.

Verifica en **Database → Replication** que la publicacion las incluya.

En la aplicacion esto se traduce en:

- Alertas nuevas aparecen sin refrescar; las `CRITICAL`/`HIGH` abren una notificacion emergente.
- La campana de notificaciones actualiza su contador en vivo.
- Los mensajes de una conversacion abierta llegan en tiempo real.

---

## 12. Edge Function (opcional)

`invite-member` permite invitar usuarios que **todavia no tienen cuenta** (requiere la
service role key, por eso vive en el servidor).

```bash
supabase functions deploy invite-member
```

Sin desplegarla, el modulo de Usuarios sigue funcionando: vincula por correo a usuarios ya
registrados mediante el RPC `add_member_by_email`.

---

## 13. Deploy en Vercel

El frontend es estatico: Vercel compila el bundle y lo sirve. No hay servidor propio, y por eso
**ninguna clave secreta interviene en el despliegue**.

### 13.1 Importar el repositorio

1. En Vercel: **Add New → Project → Import Git Repository** y elige el repositorio.
2. No cambies nada en la pantalla de configuracion: [`vercel.json`](vercel.json) ya define el
   framework (`vite`), el directorio de salida (`dist`), las cabeceras de seguridad, el reescrito
   de SPA y los comandos de instalacion y build con **pnpm**.

> El repositorio versiona `pnpm-lock.yaml`, asi que el install usa
> `pnpm install --frozen-lockfile`: si el lockfile no coincide con `package.json`, el deploy falla
> en lugar de instalar versiones distintas a las probadas.

### 13.2 Variables de entorno

**Vite las incrusta en el bundle al compilar, no las lee en tiempo de ejecucion.** Consecuencias
practicas: hay que crearlas *antes* del primer build, y cada cambio exige un **Redeploy** para que
surta efecto.

En **Settings → Environment Variables**, para *Production* y *Preview*:

| Variable | Obligatoria | Valor |
| -------- | ----------- | ----- |
| `VITE_SUPABASE_URL` | si | `https://<tu-proyecto>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | si | La clave publica (`sb_publishable_...`). Sirve igual `VITE_SUPABASE_ANON_KEY` con el JWT clasico: la app acepta cualquiera de las dos |
| `VITE_APP_ENV` | recomendada | `production` (activa el modo produccion: sin logs de depuracion) |
| `VITE_APP_NAME` | no | `EdiFeasy` |
| `VITE_SENTRY_DSN` | no | DSN de Sentry si lo conectas |

**Lo que NO se agrega en Vercel:**

- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL`: solo los usa `npm run seed` desde tu maquina. La
  clave secreta salta la Row Level Security por completo; en el despliegue no aporta nada y su
  presencia solo agrega riesgo.
- `SEED_DEFAULT_PASSWORD`: idem, es del seed local.

Si falta una variable obligatoria, la app **no falla con un error de red opaco**:
[`EnvGuard`](src/components/EnvGuard.tsx) muestra una pantalla que dice exactamente cual falta.
Es la forma rapida de confirmar si el problema es de configuracion.

### 13.3 Autorizar la URL en Supabase

Sin este paso el acceso funciona, pero los correos de confirmacion y de recuperacion de contrasena
llevan a un enlace rechazado: la app construye el retorno con el dominio desde el que se abrio
(`window.location.origin`) y Supabase solo acepta destinos declarados.

En Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://<tu-proyecto>.vercel.app`
- **Redirect URLs**, una por linea:
  ```
  https://<tu-proyecto>.vercel.app/login
  https://<tu-proyecto>.vercel.app/reset-password
  https://<tu-proyecto>-*.vercel.app/**
  http://localhost:5173/**
  ```

La tercera linea cubre los despliegues *Preview*, que reciben una URL distinta en cada commit; la
cuarta mantiene funcionando el entorno local.

### 13.4 Comprobar el despliegue

1. Abre la URL: debe cargar la pantalla de acceso.
2. Entra a `/register`: si el desplegable de condominios se llena, la conexion con Supabase quedo
   bien (esos catalogos se leen sin sesion).
3. Prueba **Olvidaste tu contrasena?** con un correo real y abre el enlace: valida el paso 13.3.

Si la pantalla de acceso carga pero el registro muestra *«Falta una funcion en la base de datos»*,
el despliegue esta bien y lo que falta es SQL: ejecuta los parches (ver [paso 5.4](#54-parches-para-bases-ya-desplegadas)).

---

## 14. Scripts

| Comando | Descripcion |
| ------- | ----------- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de produccion |
| `npm run preview` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run test` | Vitest (una pasada) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run seed` | Crea los usuarios de prueba en Supabase Auth |
| `npm run check` | Diagnostica la conexion: esquema, tablas, RPC, Auth y datos |
| `npm run deadcode` | Detecta archivos y exportaciones sin usar |
| `npm run screenshots` | Captura las pantallas en `docs/img/` (requiere `npm run dev`) |
| `npm run guide` | Reconstruye la guia de uso y genera los dos PDF de `docs/` |
| `npm run responsive` | Audita 4 vistas a 1920/1440/1024/768/390 px: desbordamiento horizontal, objetivos tactiles < 44 px y campos con letra < 16 px (requiere `npm run dev`) |

---

## 15. Arquitectura

```
src/
├── components/        # UI compartida (DataTable, StatCard, estados, formularios, layout)
│   ├── charts/        # Recharts encapsulado
│   ├── forms/         # Campos conectados a React Hook Form + Zod
│   ├── layout/        # Sidebar, Topbar, NotificationBell, GlobalSearch
│   ├── routing/       # ProtectedRoute, PublicOnlyRoute, RoleGuard
│   └── ui/            # PageHeader, DataTable, FormDrawer, estados, iconos
├── constants/         # Roles, permisos, enums con etiquetas y colores, navegacion
├── features/          # Un modulo por dominio: components/ + pages/
│   ├── activity/  alerts/  announcements/  apartments/  auth/  buildings/
│   ├── condominiums/  dashboard/  documents/  expenses/  fines/  incidents/
│   └── messages/  misc/  purchases/  reports/  requests/  residents/  settings/  users/
├── hooks/             # TanStack Query por dominio (useAlerts, useFines, ...)
├── layouts/           # AppLayout (privado) y AuthLayout (publico)
├── lib/               # supabase, env, errors, logger, notify, queryClient, queryKeys
├── providers/         # AuthProvider + AppProviders
├── routes/            # Router con guards por rol y code splitting
├── schemas/           # Zod por dominio
├── services/          # Acceso a datos: 18 servicios + helpers de listado
├── styles/            # Tailwind + estilos globales
├── test/              # Utilidades de testing
├── types/             # database.ts (tipos de la BD) y models.ts (vistas enriquecidas)
└── utils/             # format, export (CSV)
```

**Reglas de la arquitectura**

- El esquema de base de datos esta centralizado en `DB_SCHEMA` (`src/lib/supabase.ts`). El cliente
  se crea con `db: { schema: DB_SCHEMA }`, los tipos usan `Database['tribuia']` y las
  suscripciones Realtime pasan `schema: DB_SCHEMA`. Para cambiar de esquema se tocan ese archivo,
  `src/types/database.ts`, el SQL y `scripts/seed-users.ts`.
- Ningun componente llama a `supabase.from(...)` directamente: todo pasa por `src/services`.
- Los hooks de `src/hooks` son la unica puerta de entrada a los servicios desde la UI.
- Los errores de PostgreSQL nunca llegan al usuario: `src/lib/errors.ts` los traduce.
- Los permisos de la UI (`src/constants/roles.ts`) son **solo cosmeticos**; la autorizacion real
  la aplica RLS.

---

## 16. Modulos

| Modulo | Ruta | Que hace |
| ------ | ---- | -------- |
| Dashboard | `/dashboard` | Tres variantes segun rol: administrativo (10 tarjetas + 5 graficas + actividad), residente y operativo (celaduria / personal de servicios) |
| Condominios | `/condominiums` | CRUD, activar/desactivar, cambiar condominio activo |
| Bloques | `/buildings` | CRUD + tarjetas de navegacion con conteo real de apartamentos |
| Apartamentos | `/apartments` | CRUD + navegacion condominio → bloque → apartamento |
| CRM del apartamento | `/apartments/:id` | 10 pestanas: resumen, residentes, propietarios, arrendatarios, vehiculos, mascotas, solicitudes, incidentes, multas y linea de tiempo |
| Mi apartamento | `/my-apartment` | Vista de propietario/arrendatario hacia su ficha CRM |
| Usuarios | `/users` | Vincular usuarios por correo, cambiar rol/estado, quitar del condominio |
| Aprobaciones | `/approvals` | Autorizar o rechazar autoregistros de propietarios y arrendatarios |
| Residentes | `/residents` | Directorio con filtros por apartamento y relacion |
| Alertas | `/alerts` | CRUD + destinatarios (condominio/bloque/apartamento/rol) + entrega en tiempo real |
| Comunicados | `/announcements` | CRUD con borrador/publicado/archivado, imagen y vigencia |
| Mensajes | `/messages` | Inbox tipo chat con conversaciones, no leidos y realtime |
| Solicitudes | `/requests` | CRUD, asignacion, comentarios y **adjuntos** |
| Incidentes | `/incidents` | CRUD, asignacion, resolucion, linea de tiempo y **evidencias** |
| Multas | `/fines` | CRUD + notificacion automatica al propietario y arrendatario |
| Gastos | `/expenses` | CRUD, categorias con color, tarjetas y graficas |
| Compras | `/purchases` | CRUD con items dinamicos; el total lo recalcula un trigger |
| Documentos | `/documents` | Carga a Storage, previsualizacion con URL firmada, descarga y borrado |
| Reportes | `/reports` | 8 graficas consolidadas con rango configurable |
| Auditoria | `/activity` | Registro completo de acciones criticas con filtros y exportacion |
| Configuracion | `/settings` | Perfil, avatar, roles del usuario y datos del condominio |

Transversal a todos los listados: busqueda del lado del servidor, paginacion, ordenamiento,
filtros, rango de fechas y exportacion a CSV del dataset completo (no solo la pagina visible).
Ademas, buscador global en el encabezado sobre 8 entidades y campana de notificaciones en vivo.

---

## 17. Modelo de roles y RLS

| Rol | Alcance |
| --- | --- |
| `SUPER_ADMIN` | Todos los condominios de la plataforma |
| `ADMINISTRATOR` | Administracion completa de su condominio |
| `SPOKESPERSON` | Consulta su condominio; publica alertas y comunicados |
| `OWNER` | Su apartamento + informacion general del condominio (incluye finanzas de solo lectura) |
| `TENANT` | Igual que OWNER **sin** acceso financiero |
| `SECURITY` | Residentes, vehiculos, mascotas e incidentes. **Sin** acceso financiero |
| `SERVICE_STAFF` | Solicitudes asignadas, incidentes y datos operativos minimos |

Un usuario puede pertenecer a varios condominios con roles distintos (`condominium_members`).
El selector del encabezado cambia el condominio activo.

**Funciones auxiliares de RLS** (todas `SECURITY DEFINER`, para evitar recursion entre politicas):

`is_super_admin`, `is_condominium_member`, `user_can_access_condominium`, `has_role`,
`user_has_role_id`, `is_condominium_admin`, `user_owns_apartment`, `user_is_tenant`,
`user_apartment_ids`, `user_building_ids`, `user_can_access_apartment`, `apartment_condominium`,
`can_view_finance`, `can_manage_finance`, `shares_condominium`, `is_conversation_participant`,
`conversation_condominium`, `request_condominium`, `request_owner`, `request_apartment`,
`purchase_condominium`, `safe_uuid`.

---

## 18. Seguridad

- **RLS** habilitado y **forzado** (`FORCE ROW LEVEL SECURITY`) en las 29 tablas.
- La `service_role` key solo se usa en `scripts/seed-users.ts` y en la Edge Function; nunca se
  prefija con `VITE_` ni llega al bundle del navegador.
- **SQL injection**: no se concatena SQL; todo pasa por PostgREST parametrizado o por funciones
  SQL con parametros tipados.
- **XSS**: React escapa por defecto y no se usa `dangerouslySetInnerHTML` en ningun punto.
- **Uploads**: validacion de tipo MIME y tamano en el cliente (`storageService`) y limites
  por bucket en el servidor.
- **Descargas**: URLs firmadas temporales (5 minutos) para buckets privados.
- **Rutas**: `ProtectedRoute` exige sesion y `RoleGuard` filtra por rol/permiso.
- **Auditoria**: triggers en 12 tablas registran CREATE/UPDATE/DELETE en `audit_logs`, ademas
  de LOGIN, LOGOUT, UPLOAD, DOWNLOAD y MESSAGE_SENT desde la aplicacion.
- Cabeceras de seguridad configuradas en `vercel.json`.

---

## 19. Testing

```bash
npm run test
```

71 pruebas cubriendo:

- Traduccion de errores de PostgreSQL/Auth (incluye que nunca se filtre el mensaje tecnico)
- Matriz de permisos por rol
- Construccion de queries: paginacion, busqueda, filtros, rangos de fecha, orden
- Validaciones Zod de login, registro, alertas, solicitudes, multas y estructura
- Login: render, validacion, envio y manejo de credenciales invalidas
- `RoleGuard`: acceso permitido y denegado por rol y por permiso
- Exportacion CSV y formateadores
- Autoregistro: solo UUID de catalogo (nunca texto libre) y solo roles OWNER/TENANT/BOTH
- Bandeja de aprobaciones: listado, vacio explicativo, motivo obligatorio para rechazar

---

## 20. PWA

La aplicacion es instalable: incluye manifest, iconos y service worker (`vite-plugin-pwa`,
estrategia `generateSW` con precache). El registro se hace solo en produccion.
No se implemento sincronizacion offline compleja.

---

## 21. Responsive

Probado en 1920, 1440, 1024, 768 y 390 px:

- Sidebar colapsable en escritorio y Drawer en movil.
- Todas las tablas usan scroll horizontal con columnas fijas (`fixed: left/right`).
- Formularios en Drawers que ocupan el 100% del ancho en pantallas de 480 px o menos.
- Buscador global reubicado bajo el encabezado en movil.
- Graficas responsive con `ResponsiveContainer`.

---

## 22. Configuraciones externas pendientes

Estas quedan fuera del codigo y dependen de tu proyecto:

1. **Sentry**: instala `@sentry/react`, define `VITE_SENTRY_DSN` y conecta
   `installSentryTransport` (ver `src/lib/logger.ts`).
2. **Correo transaccional**: configura un SMTP propio en Supabase para produccion
   (el SMTP por defecto tiene limites bajos).
3. **Edge Function `invite-member`**: desplegarla si quieres invitar usuarios nuevos por correo.
4. **Exportacion a Excel/PDF**: la arquitectura ya esta lista en `src/utils/export.ts`;
   basta instalar `xlsx` o `jspdf` y marcar el exportador como `available`.
5. **Dominio propio** en Vercel y su registro en las Redirect URLs de Supabase.
