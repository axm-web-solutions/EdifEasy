# Pagos con Wompi

Tres flujos de pago, todos cobrados con [Wompi](https://wompi.com):

| Seccion | Quien paga | Que paga |
|---|---|---|
| **Cuotas de administracion** (`/admin-fees`) | Propietario | La cuota mensual de cada uno de sus apartamentos |
| **Multas** (`/fines`) | Residentes del apartamento multado (propietario, arrendatario o residente con cuenta) | Cada multa pendiente |
| **Planes** (`/plans`) | Administrador | EdiFeasy para todo el conjunto: mensual, semestral o anual |

Precio del plan: **$4.500** por apartamento al mes si el conjunto tiene menos de 80
apartamentos y **$4.000** si tiene 80 o mas. Lo calcula `tribuia.subscription_quote`.

## Como funciona

1. El usuario pulsa **Pagar**. La Edge Function `wompi-payments` calcula el valor
   con la base de datos (nunca con lo que envia el navegador), crea el registro en
   `payments` con estado `PENDING` y devuelve la URL del Web Checkout de Wompi,
   firmada con el secreto de integridad.
2. El usuario paga en Wompi (PSE, tarjeta, Nequi, Boton Bancolombia) y vuelve a
   `/payments/result?id=<transaccion>`. Una multa apelada no se puede pagar
   hasta que el administrador la vuelva a dejar como pendiente.
3. El pago se confirma por dos vias, ambas idempotentes:
   - **Webhook** `wompi-webhook`: Wompi avisa aunque el usuario cierre el navegador.
   - **Verificacion** desde `/payments/result`: consulta la transaccion en Wompi.
4. `tribuia.apply_payment_result` marca la cuota o la multa como pagada, o crea el
   periodo del plan. Si el monto cobrado no coincide con el registrado, el pago queda en `ERROR`.

## Puesta en marcha

### 1. Base de datos

Aplica las migraciones de `supabase/migrations/` en orden (por ejemplo
`20261013000000_pagos_wompi.sql` y `20261014000000_pago_multas.sql`). Ya estan
incluidas en `supabase/schema.sql` para instalaciones nuevas.

### 2. Llaves de Wompi

En el panel de Wompi > **Desarrolladores** copia (empieza con las de sandbox):

- Llave publica: `pub_test_...`
- Secreto de integridad: `test_integrity_...`
- Secreto de eventos: `test_events_...`

```bash
supabase secrets set \
  WOMPI_PUBLIC_KEY=pub_test_xxx \
  WOMPI_INTEGRITY_SECRET=test_integrity_xxx \
  WOMPI_EVENTS_SECRET=test_events_xxx \
  APP_URLS=http://localhost:5173,https://tu-dominio.com
```

`APP_URLS` (opcional pero recomendado) limita a que dominios puede volver Wompi.
Las llaves `pub_test_` usan el sandbox; al cambiar a `pub_prod_` se cobra de verdad.

### 3. Desplegar las funciones

```bash
supabase functions deploy wompi-payments
supabase functions deploy wompi-webhook --no-verify-jwt
```

### 4. URL de eventos en Wompi

En Wompi > **Desarrolladores** > **URL de Eventos** registra:

```
https://<ref-del-proyecto>.supabase.co/functions/v1/wompi-webhook
```

## Pruebas en sandbox

- **Tarjeta aprobada:** `4242 4242 4242 4242`, cualquier CVC y fecha futura.
- **Tarjeta rechazada:** `4111 1111 1111 1111`.
- **Nequi:** `3991111111` aprueba, `3992222222` rechaza.
- **PSE:** elige el banco de pruebas y el resultado que quieres simular.
