# EdiFeasy

SaaS multi-tenant para administrar conjuntos residenciales en Colombia.
React 18 + TypeScript + Vite + Ant Design + Tailwind (sin preflight) + React Query,
sobre Supabase (Postgres con RLS, Auth, Storage, Edge Functions en Deno). Todo el
dominio vive en el esquema `tribuia`. Textos de la UI en espanol.

## Comandos

- `pnpm dev` / `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test`
- `pnpm responsive` audita desbordes y tamanos tactiles (requiere `pnpm dev`).

## Arquitectura del frontend: Vistas + ViewModels

Regla: **ninguna logica de negocio dentro de los componentes**.

| Capa | Donde | Que contiene |
|---|---|---|
| Modelo | `src/services/*Service.ts`, `src/types/*`, `src/schemas/*` | Acceso a Supabase, tipos de la base y validaciones zod. Sin React. |
| Datos | `src/hooks/use*.ts` | Queries y mutations de React Query sobre los servicios. |
| ViewModel | `src/features/<modulo>/viewmodels/use<Pantalla>ViewModel.ts` | Estado de la pantalla, derivados (totales, filtros, permisos), formularios y acciones. Devuelve un objeto plano para la vista. |
| Vista | `src/features/<modulo>/pages/*.tsx` y `components/*.tsx` | Solo renderiza lo que entrega el ViewModel y le pasa los eventos. Sin `reduce`, sin reglas de permisos, sin llamadas a servicios. |
| UI reutilizable | `src/components/ui/*` | Componentes presentacionales genericos (`PageHeader`, `StatCard`, `DataTable`, `MobileRecordList`, `FormDrawer`, `states`). |

Codigo nuevo debe seguir esta separacion. El codigo existente se migra por modulo
(muchas paginas aun mezclan logica y vista).

## Base de datos

- **Migraciones**: todo cambio de esquema va en `supabase/migrations/<timestamp>_<nombre>.sql`,
  idempotente, y se refleja tambien en `supabase/schema.sql` (esquema consolidado para
  instalaciones nuevas). `supabase/patches/` es historico: no agregar parches nuevos.
- **RLS siempre activo**. Usar `(select auth.uid())` en politicas y los helpers
  `has_role`, `is_condominium_admin`, `is_super_admin`, `user_owns_apartment`,
  `user_apartment_ids`. El administrador solo opera sobre sus condominios; el
  `SUPER_ADMIN` (rol global en `user_roles`) opera sobre todos.
- Lo que solo debe escribir el servidor (pagos) no tiene politicas de escritura y se
  escribe con la service role desde Edge Functions.
- `alter type ... add value` no se puede usar en la misma transaccion: comparar con
  `::text` o leer `pg_enum`.
- Probar SQL antes de entregarlo (ver agente `database-expert`).

## Producto

- `docs/checklist-competencia.md` es la fuente unica de lo que tenemos y lo que falta frente a
  ConjuntosApp y PH en Linea. Al terminar una funcionalidad, actualizalo con el agente
  `product-roadmap` (estados con evidencia en el codigo, resumen e historial).

## Diseno

- Color de marca por condominio en `settings.primaryColor`, expuesto como
  `--edifeasy-brand` por `BrandThemeProvider`. No fijar colores de marca en codigo.
- Anchos que deben funcionar: 390, 768, 1024, 1440 y 1920 px.
