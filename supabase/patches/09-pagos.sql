-- ============================================================================
-- PARCHE 09 :: Pagos con Wompi - Cuotas de administracion y planes del sistema
-- ----------------------------------------------------------------------------
-- Dos flujos de pago, ambos cobrados con Wompi:
--
--   1. Cuota de administracion: el ADMINISTRADOR define el valor mensual (igual
--      para todos los apartamentos) y genera las cuotas del mes. Cada
--      PROPIETARIO paga las cuotas de sus apartamentos.
--
--   2. Plan del sistema (suscripcion a EdiFeasy): el ADMINISTRADOR hace un unico
--      pago por todo el conjunto, mensual, semestral o anual. Precio por
--      apartamento al mes: $4.500 si el conjunto tiene menos de 80
--      apartamentos, $4.000 si tiene 80 o mas.
--
-- Que hace:
--   A. Enums `payment_kind`, `payment_status`, `plan_period`, `admin_fee_status`.
--   B. Tablas `admin_fees`, `payments` y `subscriptions` con indices y triggers.
--   C. RLS: los pagos solo se escriben desde la Edge Function (service role);
--      el navegador nunca puede marcar algo como pagado.
--   D. RPCs: `subscription_quote`, `generate_admin_fees` y
--      `apply_payment_result` (esta ultima solo para la service role).
--
-- Seguro de re-ejecutar desde el SQL Editor (todo es idempotente).
-- Despues de aplicarlo hay que desplegar las Edge Functions `wompi-payments`
-- y `wompi-webhook` (ver supabase/functions/README-pagos.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. TIPOS ENUM
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'payment_kind') then
    create type tribuia.payment_kind as enum ('ADMIN_FEE', 'SUBSCRIPTION');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'payment_status') then
    create type tribuia.payment_status as enum ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'plan_period') then
    create type tribuia.plan_period as enum ('MONTHLY', 'SEMIANNUAL', 'ANNUAL');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'tribuia' and t.typname = 'admin_fee_status') then
    create type tribuia.admin_fee_status as enum ('PENDING', 'PAID', 'CANCELLED');
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- B. TABLAS
-- ----------------------------------------------------------------------------

-- Cuotas de administracion: una por apartamento y por mes.
create table if not exists tribuia.admin_fees (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id    uuid not null references tribuia.apartments (id) on delete cascade,
  period          date not null,               -- primer dia del mes cobrado
  amount          numeric(14, 2) not null check (amount > 0),
  due_date        date not null,
  status          tribuia.admin_fee_status not null default 'PENDING',
  paid_at         timestamptz,
  payment_method  text,                        -- WOMPI, CASH, TRANSFER...
  notes           text,
  created_by      uuid references tribuia.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (apartment_id, period)
);

create index if not exists idx_admin_fees_condominium on tribuia.admin_fees (condominium_id, period desc, status);
create index if not exists idx_admin_fees_apartment on tribuia.admin_fees (apartment_id, period desc);

-- Intentos de pago (cada clic en "Pagar" crea uno con su referencia unica).
create table if not exists tribuia.payments (
  id                    uuid primary key default gen_random_uuid(),
  condominium_id        uuid not null references tribuia.condominiums (id) on delete cascade,
  kind                  tribuia.payment_kind not null,
  reference             text not null unique,
  amount                numeric(14, 2) not null check (amount > 0),
  currency              text not null default 'COP',
  status                tribuia.payment_status not null default 'PENDING',
  payer_id              uuid references tribuia.profiles (id) on delete set null,
  admin_fee_id          uuid references tribuia.admin_fees (id) on delete set null,
  plan_period           tribuia.plan_period,
  apartments_count      integer,
  unit_price            numeric(14, 2),
  wompi_transaction_id  text,
  payment_method        text,
  status_message        text,
  paid_at               timestamptz,
  raw                   jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    (kind = 'ADMIN_FEE' and admin_fee_id is not null)
    or (kind = 'SUBSCRIPTION' and plan_period is not null)
  )
);

create index if not exists idx_payments_condominium on tribuia.payments (condominium_id, kind, created_at desc);
create index if not exists idx_payments_payer on tribuia.payments (payer_id, created_at desc);
create index if not exists idx_payments_admin_fee on tribuia.payments (admin_fee_id);

alter table tribuia.admin_fees
  add column if not exists payment_id uuid references tribuia.payments (id) on delete set null;

-- Periodos pagados del plan del sistema.
create table if not exists tribuia.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  condominium_id    uuid not null references tribuia.condominiums (id) on delete cascade,
  plan_period       tribuia.plan_period not null,
  apartments_count  integer not null,
  unit_price        numeric(14, 2) not null,
  amount            numeric(14, 2) not null,
  starts_at         date not null,
  ends_at           date not null,
  payment_id        uuid references tribuia.payments (id) on delete set null,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_subscriptions_condominium on tribuia.subscriptions (condominium_id, ends_at desc);

drop trigger if exists trg_admin_fees_updated_at on tribuia.admin_fees;
create trigger trg_admin_fees_updated_at
  before update on tribuia.admin_fees
  for each row execute function tribuia.set_updated_at();

drop trigger if exists trg_payments_updated_at on tribuia.payments;
create trigger trg_payments_updated_at
  before update on tribuia.payments
  for each row execute function tribuia.set_updated_at();

-- ----------------------------------------------------------------------------
-- C. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table tribuia.admin_fees enable row level security;
alter table tribuia.payments enable row level security;
alter table tribuia.subscriptions enable row level security;

drop policy if exists admin_fees_select on tribuia.admin_fees;
drop policy if exists admin_fees_write on tribuia.admin_fees;
drop policy if exists payments_select on tribuia.payments;
drop policy if exists subscriptions_select on tribuia.subscriptions;

-- Administracion ve todas las cuotas; cada propietario solo las suyas.
create policy admin_fees_select on tribuia.admin_fees for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or tribuia.user_owns_apartment(apartment_id)
  );

-- Solo administracion crea/edita cuotas (p. ej. registrar un pago en efectivo).
-- Los pagos en linea los marca `apply_payment_result` desde la Edge Function.
create policy admin_fees_write on tribuia.admin_fees for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- Pagos: quien paga ve los suyos; administracion ve los del conjunto.
-- Sin politicas de escritura: solo la service role (Edge Function) escribe.
create policy payments_select on tribuia.payments for select to authenticated
  using (
    payer_id = auth.uid()
    or tribuia.is_condominium_admin(condominium_id)
  );

create policy subscriptions_select on tribuia.subscriptions for select to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

grant select, insert, update, delete on tribuia.admin_fees to authenticated;
grant select on tribuia.payments to authenticated;
grant select on tribuia.subscriptions to authenticated;
grant all on tribuia.admin_fees, tribuia.payments, tribuia.subscriptions to service_role;

-- ----------------------------------------------------------------------------
-- D. FUNCIONES
-- ----------------------------------------------------------------------------

-- Precio del plan. Unica fuente de verdad: la usa la pantalla de planes para
-- mostrar valores y la Edge Function para cobrar (nunca se confia en el cliente).
create or replace function tribuia.subscription_quote(p_condominium uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_count  integer;
  v_unit   numeric;
  v_active jsonb;
begin
  if not (tribuia.is_condominium_admin(p_condominium) or auth.role() = 'service_role') then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;

  select count(*) into v_count from tribuia.apartments where condominium_id = p_condominium;
  v_unit := case when v_count < 80 then 4500 else 4000 end;

  select to_jsonb(s) into v_active
    from tribuia.subscriptions s
   where s.condominium_id = p_condominium
   order by s.ends_at desc
   limit 1;

  return jsonb_build_object(
    'apartments_count', v_count,
    'unit_price', v_unit,
    'plans', jsonb_build_array(
      jsonb_build_object('period', 'MONTHLY',    'months', 1,  'amount', v_count * v_unit * 1),
      jsonb_build_object('period', 'SEMIANNUAL', 'months', 6,  'amount', v_count * v_unit * 6),
      jsonb_build_object('period', 'ANNUAL',     'months', 12, 'amount', v_count * v_unit * 12)
    ),
    'current', v_active
  );
end;
$$;

-- Genera la cuota del mes para cada apartamento con propietario activo.
-- Las que ya existen para ese mes no se duplican. Guarda el valor como
-- predeterminado del conjunto (settings.adminFeeAmount).
create or replace function tribuia.generate_admin_fees(
  p_condominium uuid,
  p_period date,
  p_amount numeric,
  p_due_date date
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_count  integer;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'No tienes permisos sobre este condominio' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El valor de la cuota debe ser mayor a cero';
  end if;
  if p_due_date < v_period then
    raise exception 'La fecha limite no puede ser anterior al mes que se cobra';
  end if;

  insert into tribuia.admin_fees (condominium_id, apartment_id, period, amount, due_date, created_by)
  select p_condominium, a.id, v_period, p_amount, p_due_date, auth.uid()
    from tribuia.apartments a
   where a.condominium_id = p_condominium
     and exists (
       select 1 from tribuia.apartment_owners o
        where o.apartment_id = a.id and o.is_active
     )
  on conflict (apartment_id, period) do nothing;

  get diagnostics v_count = row_count;

  update tribuia.condominiums
     set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('adminFeeAmount', p_amount)
   where id = p_condominium;

  return v_count;
end;
$$;

-- Aplica el resultado de una transaccion de Wompi. Idempotente: un pago ya
-- aprobado no se vuelve a procesar. Verifica que el monto cobrado coincida con
-- el registrado. Solo la invoca la service role (Edge Functions).
create or replace function tribuia.apply_payment_result(
  p_reference       text,
  p_transaction_id  text,
  p_status          text,
  p_amount_in_cents bigint,
  p_currency        text,
  p_method          text,
  p_message         text,
  p_payload         jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_payment tribuia.payments%rowtype;
  v_status  tribuia.payment_status;
  v_start   date;
  v_months  integer;
begin
  select * into v_payment from tribuia.payments where reference = p_reference for update;
  if not found then
    raise exception 'Pago no encontrado: %', p_reference;
  end if;

  if v_payment.status = 'APPROVED' then
    return jsonb_build_object('id', v_payment.id, 'status', v_payment.status, 'kind', v_payment.kind);
  end if;

  v_status := case p_status
    when 'APPROVED' then 'APPROVED'
    when 'DECLINED' then 'DECLINED'
    when 'VOIDED'   then 'VOIDED'
    when 'ERROR'    then 'ERROR'
    else 'PENDING'
  end::tribuia.payment_status;

  -- Proteccion contra montos manipulados: lo cobrado debe ser lo registrado.
  if v_status = 'APPROVED'
     and (p_amount_in_cents <> round(v_payment.amount * 100) or coalesce(p_currency, 'COP') <> v_payment.currency) then
    v_status := 'ERROR';
    p_message := 'El monto cobrado no coincide con el valor del pago';
  end if;

  update tribuia.payments
     set status = v_status,
         wompi_transaction_id = coalesce(p_transaction_id, wompi_transaction_id),
         payment_method = coalesce(p_method, payment_method),
         status_message = p_message,
         paid_at = case when v_status = 'APPROVED' then now() else paid_at end,
         raw = coalesce(p_payload, '{}'::jsonb)
   where id = v_payment.id;

  if v_status = 'APPROVED' then
    if v_payment.kind = 'ADMIN_FEE' then
      update tribuia.admin_fees
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.admin_fee_id;
    else
      -- El nuevo periodo empieza hoy o cuando termine el plan vigente.
      select greatest(current_date, coalesce(max(ends_at), current_date)) into v_start
        from tribuia.subscriptions where condominium_id = v_payment.condominium_id;

      v_months := case v_payment.plan_period
        when 'MONTHLY' then 1 when 'SEMIANNUAL' then 6 else 12 end;

      insert into tribuia.subscriptions
        (condominium_id, plan_period, apartments_count, unit_price, amount, starts_at, ends_at, payment_id)
      values
        (v_payment.condominium_id, v_payment.plan_period, v_payment.apartments_count,
         v_payment.unit_price, v_payment.amount, v_start,
         (v_start + make_interval(months => v_months))::date, v_payment.id);
    end if;
  end if;

  return jsonb_build_object('id', v_payment.id, 'status', v_status, 'kind', v_payment.kind);
end;
$$;

revoke all on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function tribuia.apply_payment_result(text, text, text, bigint, text, text, text, jsonb) to service_role;
grant execute on function tribuia.subscription_quote(uuid) to authenticated, service_role;
grant execute on function tribuia.generate_admin_fees(uuid, date, numeric, date) to authenticated;

-- Refresca el cache de PostgREST para que las RPCs nuevas respondan de inmediato.
notify pgrst, 'reload schema';

-- Verificacion rapida ---------------------------------------------------------
select tablename from pg_tables
 where schemaname = 'tribuia' and tablename in ('admin_fees', 'payments', 'subscriptions')
 order by 1;
