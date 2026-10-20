# Checklist de producto vs. competencia

> Fuente unica de lo que EdiFeasy tiene y le falta frente a **ConjuntosApp**
> (conjuntosapp.co/funciones) y **PH en Linea** (phenlinea.info/Home/Productos).
> Lo mantiene el agente `product-roadmap` (`.claude/agents/product-roadmap.md`):
> cada estado debe tener **evidencia en el codigo** (archivo, migracion o ruta).
>
> **Ultima revision:** 2026-10-20 · **Competencia revisada por ultima vez:** 2026-10-17

**Leyenda:** ✅ Tiene · 🟡 Parcial · ❌ No tiene · ➖ No lo menciona (competencia)
**Prioridad:** 🔴 Critica · 🟠 Alta · 🟡 Media · ⚪ Baja

## Resumen

| Indicador | Valor |
|---|---|
| Brechas abiertas | 24 · 🔴 1 · 🟠 5 · 🟡 11 · ⚪ 7 |
| Funciones en paridad con la competencia | 19 |
| Brechas cerradas desde el comparativo inicial (2026-10-17) | 6 (reservas, clasificados, alta rapida, minuta de porteria, encuestas, ingreso del personal) |
| Diferenciadores de EdiFeasy | 17 |
| Siguiente recomendado | G01 cuenta Wompi por conjunto → G02/G03 estado de cuenta y mora → G07 importar Excel |

---

## 1. Brechas abiertas (lo que nos falta), en orden de trabajo

| ID | Funcion | Prioridad | Esfuerzo | ConjuntosApp | PH en Linea | Estado | Notas para implementar |
|---|---|---|---|---|---|---|---|
| G01 | El dinero de cuotas, multas y reservas llega a la cuenta de **cada conjunto** | 🔴 | Medio | ✅ | ➖ | ❌ | Hoy todo entra a una sola cuenta Wompi (secrets globales en Supabase). Guardar llaves Wompi por conjunto cifradas en el servidor; EdiFeasy solo cobra su plan. Bloquea cobrar cuotas reales. |
| G02 | Estado de cuenta consolidado por apartamento | 🟠 | Medio | ✅ | ✅ | 🟡 | Cuotas y multas se ven en pantallas separadas. Falta saldo unico con abonos, descargable. |
| G03 | Recordatorios automaticos de mora y cartera por edades | 🟠 | Medio | ✅ | ✅ | 🟡 | Existen totales de pendiente y vencido. Recordatorios deben respetar Ley 2300 de 2023 (L-V 7am-7pm, sab 8am-3pm, un canal por semana). |
| G04 | Asambleas virtuales o hibridas (quorum por coeficiente, poderes, orden del dia) | 🟠 | Medio-Alto | ✅ | ✅ | ❌ | Tablas `meetings` y `meeting_signatures` existen sin pantalla. Ley 675 art. 42 y Decreto 398 de 2020. Base disponible: encuestas (C18) con voto, cierre por fecha y resultados. Falta quorum por coeficiente, poderes y orden del dia. Esfuerzo bajado de Alto a Medio-Alto el 2026-10-20 por el motor de encuestas. |
| G05 | Votaciones en linea ponderadas por coeficiente | 🟠 | Medio-Alto | ✅ | ✅ | ❌ | Va con G04. `submit_survey_vote` en `20261019400000_minuta_personal_encuestas.sql` ya vota por persona o por apartamento (`vote_scope` PERSON/UNIT); falta ponderar por coeficiente. Esfuerzo bajado de Alto a Medio-Alto el 2026-10-20. |
| G06 | Acta automatica de la asamblea | 🟠 | Medio | ✅ | ✅ | ❌ | Va con G04/G05. |
| G07 | Importar apartamentos, residentes y vehiculos desde Excel | 🟡 | Bajo | ✅ | ➖ | ❌ | Solo exportamos CSV. Acelera la entrada de conjuntos reales. |
| G08 | Autorizacion de visitantes con QR | 🟡 | Medio | ✅ | ✅ | ❌ | QR generado por el residente y leido en porteria. |
| G09 | Visitas recurrentes programadas (empleadas, profesores) | 🟡 | Bajo | ➖ | ✅ | ❌ | Dias y horario fijos. |
| G10 | Paqueteria y encomiendas | 🟡 | Bajo | ➖ | ✅ | ❌ | Recepcion con foto, aviso al residente y firma de entrega. La minuta (C17) ya tiene la categoria PAQUETE, pero sin aviso al residente ni firma de entrega. |
| G12 | Control de rondas | 🟡 | Bajo | ➖ | ✅ | ❌ | Puntos de control con QR y hora. La minuta (C17) ya permite anotar rondas (categoria RONDA), sin puntos de control. |
| G14 | Confirmacion de lectura de comunicados | 🟡 | Bajo | ✅ | ➖ | ❌ | Saber quien leyo cada publicacion del feed. |
| G15 | Notificaciones push al celular | 🟡 | Medio | ✅ | ➖ | 🟡 | Hay notificaciones en la app en tiempo real; push depende de la app movil (proyecto aparte). |
| G16 | Mantenimiento con fotos y costo de materiales | 🟡 | Bajo | ✅ | ➖ | 🟡 | Las solicitudes ya aceptan adjuntos; falta costo y cierre con evidencia. |
| G17 | Prueba gratis | 🟡 | Bajo | ✅ (7 dias) | ➖ | ❌ | Decision comercial. En desarrollo (sin commit): `20261020000000_prueba_gratis.sql` (7 dias, `start_trial`). |
| G18 | Asistente por WhatsApp (PQRS, deuda, reservas) | 🟡 | Alto | ✅ | ✅ | ❌ | WhatsApp Business API. Hoy solo hay enlaces wa.me. |
| G19 | Facturacion electronica y contabilidad | ⚪ | Muy alto | ➖ | ✅ | ❌ | Proveedor de factura electronica DIAN. |
| G20 | Parqueaderos de visitantes y cobro por tiempo | ⚪ | Medio | ✅ | ➖ | 🟡 | Hay puesto por apartamento en vehiculos. |
| G21 | Presupuesto y proyecciones | ⚪ | Medio | ➖ | ✅ | ❌ | — |
| G22 | Informes con IA | ⚪ | Medio | ✅ | ➖ | ❌ | Reportes con graficas ya existen. |
| G23 | Objetos perdidos | ⚪ | Bajo | ➖ | ✅ | ❌ | Podria ser una categoria del marketplace o del feed. |
| G24 | Citofonia virtual | ⚪ | Muy alto | ✅ | ✅ | ❌ | Telefonia y hardware. |
| G25 | Biometria o reconocimiento facial | ⚪ | Muy alto | ➖ | ✅ | ❌ | Hardware en porteria. |
| G27 | App nativa iOS y Android | 🟡 | Alto | ✅ | ➖ | ❌ | Proyecto aparte (React Native + Expo). No se trabaja en este repositorio. |

## 2. Cerrado (lo que ya tenemos y la competencia tambien)

| ID | Funcion | Estado | Evidencia | Cerrado |
|---|---|---|---|---|
| C01 | Pago en linea de cuotas (PSE, tarjeta, Nequi, Boton Bancolombia) | ✅ | `supabase/functions/wompi-payments`, `src/features/payments` · desplegado en produccion (sandbox) | 2026-10-19 |
| C02 | Reservas de zonas comunes con reglas, aprobacion y pago | ✅ | `20261019000000_reservas_zonas_comunes.sql`, `src/features/requests/components/ReservationsPanel.tsx` | 2026-10-19 |
| C03 | Alta rapida del conjunto | ✅ | Alta desde el RUT `/platform/new` + cuentas por unidad (`provision-condominium`) | 2026-10-19 |
| C04 | Clasificados entre vecinos | ✅ | `20261019100000_clasificados_marketplace.sql`, `/marketplace` | 2026-10-19 |
| C05 | Control de visitantes en tiempo real | ✅ | `/visitors` | — |
| C06 | Comunicados y feed segmentado (conjunto, bloque, rol) | ✅ | `src/features/feed`, `/announcements` | 2026-10-18 |
| C07 | Chat residente-administracion | ✅ | `/messages` | — |
| C08 | PQRS con responsable y comentarios | ✅ | `/requests` | — |
| C09 | Registro de pagos en efectivo | ✅ | Cuotas y reservas ("Pago recibido") | — |
| C10 | Gastos y compras | ✅ | `/expenses`, `/purchases` | — |
| C11 | Documentos del conjunto | ✅ | `/documents` | — |
| C12 | Varios conjuntos en una cuenta | ✅ | Selector de conjunto, membresias por rol | — |
| C13 | Directorio de residentes | ✅ | `/residents` | — |
| C14 | Informes de gestion con graficas | ✅ | `/reports` | — |
| C15 | App instalable (PWA) | ✅ | `vite.config.ts` (VitePWA), iconos de marca | 2026-10-19 |
| C16 | Cumplimiento Ley 1581 | ✅ | `20261019200000_cumplimiento_legal.sql`, `/legal/*`, Configuracion > Privacidad y datos, Plataforma > Cumplimiento legal | 2026-10-19 |
| C17 | Minuta digital de porteria (antes G11) | ✅ | Tabla `guard_log_entries` en `20261019400000_minuta_personal_encuestas.sql` (inmutable, urgentes notifican a la administracion), `src/features/logbook`, `/logbook` (`src/routes/index.tsx:288`) · commit a179668 | 2026-10-20 |
| C18 | Encuestas (antes G13) | ✅ | Tablas `surveys`, `survey_questions`, `survey_options`, `survey_votes`, `survey_ballots` y RPCs `set_survey_status`, `submit_survey_vote`, `survey_results` en `20261019400000_minuta_personal_encuestas.sql`, `src/features/surveys`, `/surveys` (`src/routes/index.tsx:280`) · commit a179668 | 2026-10-20 |
| C19 | Ingreso y salida de empleados y contratistas (antes G26) | ✅ | Tabla `staff_shifts` y RPCs `staff_check_in`, `staff_check_out`, `staff_roster` en `20261019400000_minuta_personal_encuestas.sql`, `src/features/staff`, `/staff` (`src/routes/index.tsx:299`) · commit a179668 | 2026-10-20 |

## 3. Diferenciadores (lo que tenemos y ellos no)

| ID | Diferenciador | Evidencia |
|---|---|---|
| D01 | Numeros de emergencia con llamada directa + policia, hospitales y bomberos cercanos | `src/features/feed/components/EmergencyCard.tsx` |
| D02 | Servicios cercanos (plomeros, cerrajeros, aseo, servicio domestico, taxis, Uber) con WhatsApp, horario y como llegar | `src/features/dashboard/components/NearbyPlacesCard.tsx`, `/marketplace?tab=servicios`, `/nearby` para todos los roles (`src/features/nearby/pages/NearbyPage.tsx`, `src/routes/index.tsx:278`) con acceso desde el inicio del residente · commit a179668 |
| D03 | Marketplace moderado por la administracion con registro de vendedores (Ley 1480 art. 53) | `marketplace_seller_registry` |
| D04 | Alta del conjunto con solo el RUT (lectura del PDF en el navegador) | `src/features/platform/viewmodels/rut.logic.ts` |
| D05 | Multas con apelacion y pago en linea | `/fines` |
| D06 | Incidentes de seguridad con evidencia y cierre | `/incidents` |
| D07 | Alertas segmentadas con prioridad y vigencia | `/alerts` |
| D08 | Mascotas y vehiculos por apartamento | `/my-apartment`, `/apartments/:id` |
| D09 | Plano visual de ocupacion | `src/components/ui/BuildingPlan.tsx` |
| D10 | Mapa del conjunto y alrededores | `NearbyPlacesCard`, `/nearby` |
| D11 | Inscripcion de residentes con aprobacion | `/approvals` |
| D12 | Auditoria de acciones | `/activity` |
| D13 | Modulos configurables por rol y conjunto | `/platform/modules`, `role_modules` |
| D14 | Marca propia por conjunto (color y logo con contraste) | `BrandThemeProvider`, `src/utils/brand.ts` |
| D15 | Tours guiados y busqueda global | `src/config/tours.ts` |
| D16 | Panel de plataforma multiconjunto | `/platform` |
| D17 | Solicitudes de titulares con plazos legales y descarga de datos | `data_requests`, `export_my_data` |

## 4. Alertas de negocio

| ID | Alerta | Estado |
|---|---|---|
| A01 | **Precio:** $4.500/apto (<80) y $4.000 (>=80) al mes. Desde ~27 apartamentos quedamos por encima de ConjuntosApp ($120.000/mes fijo, ilimitado). | Abierta · decision comercial |
| A02 | **Recaudo de terceros:** todo el dinero entra a la cuenta Wompi de EdiFeasy (ver G01). Revisar con contador y Wompi. | Abierta |

## 5. Pendientes operativos (no son codigo)

| ID | Pendiente | Responsable | Estado |
|---|---|---|---|
| P01 | Llaves de produccion de Wompi (`pub_prod_…`) cuando aprueben el comercio | Equipo | Abierto (hoy sandbox) |
| P02 | Llenar datos legales del operador en Plataforma > Cumplimiento legal | Equipo | Abierto |
| P03 | Crear las cuentas de propietarios de Angeles del Bosque (Plataforma > Propietarios) | Equipo | Abierto |
| P04 | Revision de los textos legales por un abogado | Equipo | Hecho segun el equipo (2026-10-19) |

---

## Historial

| Fecha | Cambio |
|---|---|
| 2026-10-17 | Comparativo inicial (20 brechas). |
| 2026-10-19 | Cerradas: reservas, clasificados, alta rapida. Nuevos diferenciadores: emergencias, servicios cercanos, alta por RUT, cumplimiento legal, feed. Pago en linea desplegado (sandbox). Checklist movido al repositorio. |
| 2026-10-19 | Revision de trabajo en curso: minuta de porteria (G11), ingreso y salida del personal (G26), encuestas (G13), prueba gratis (G17), mapa de servicios para residentes e inicio del residente (saludo por hora, aviso de alertas descartable). Todo sin commit en `main`: anotado como en desarrollo, sin cambiar estados ni conteos. G04/G05 siguen abiertas (encuestas sin coeficiente ni quorum). |
| 2026-10-20 | Cerradas con el commit a179668: minuta de porteria (G11 → C17), encuestas (G13 → C18), ingreso y salida del personal (G26 → C19). Mapa de servicios cercanos para todos en `/nearby` (D02, D10). G04/G05 bajan de esfuerzo Alto a Medio-Alto por el motor de encuestas. G17 sigue abierta (`20261020000000_prueba_gratis.sql` sin commit). Abiertas 27 → 24, paridad 16 → 19. |
