-- ============================================================================
-- PARCHE 10 :: Pago de multas con Wompi
-- ----------------------------------------------------------------------------
-- Extiende los pagos del parche 09 a las multas: quien vive en el apartamento
-- multado (propietario, arrendatario o residente con cuenta, la misma regla con
-- la que ya ve sus multas) puede pagarla en linea.
--
-- Que hace:
--   A. Agrega 'FINE' al enum `payment_kind`.
--   B. `payments.fine_id` y la regla de destino de cada tipo de pago.
--   C. `fines.paid_at`, `fines.payment_method` y `fines.payment_id`.
--   D. `apply_payment_result` marca la multa como pagada al aprobarse.
--
-- Requiere el parche 09. Seguro de re-ejecutar desde el SQL Editor.
-- Despues de aplicarlo, re-desplegar la Edge Function `wompi-payments`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ENUM
-- ----------------------------------------------------------------------------
alter type tribuia.payment_kind add value if not exists 'FINE';

-- ----------------------------------------------------------------------------
-- B. PAGOS: referencia a la multa
-- ----------------------------------------------------------------------------
alter table tribuia.payments
  add column if not exists fine_id uuid references tribuia.fines (id) on delete set null;

create index if not exists idx_payments_fine on tribuia.payments (fine_id);

-- Cada tipo de pago apunta a lo que paga. Se compara `kind::text` porque el
-- valor 'FINE' recien agregado no puede usarse como literal en esta transaccion.
alter table tribuia.payments drop constraint if exists payments_check;
alter table tribuia.payments drop constraint if exists payments_target_check;
alter table tribuia.payments add constraint payments_target_check check (
  (kind::text = 'ADMIN_FEE' and admin_fee_id is not null)
  or (kind::text = 'SUBSCRIPTION' and plan_period is not null)
  or (kind::text = 'FINE' and fine_id is not null)
);

-- ----------------------------------------------------------------------------
-- C. MULTAS: datos del pago
-- ----------------------------------------------------------------------------
alter table tribuia.fines add column if not exists paid_at timestamptz;
alter table tribuia.fines add column if not exists payment_method text;
alter table tribuia.fines
  add column if not exists payment_id uuid references tribuia.payments (id) on delete set null;

-- ----------------------------------------------------------------------------
-- D. APLICAR RESULTADO (reemplaza la version del parche 09)
-- ----------------------------------------------------------------------------
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
    -- Se compara como texto: 'FINE' se agrega al enum en este mismo script.
    if v_payment.kind::text = 'ADMIN_FEE' then
      update tribuia.admin_fees
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.admin_fee_id;
    elsif v_payment.kind::text = 'FINE' then
      update tribuia.fines
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.fine_id;
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

-- Refresca el cache de PostgREST.
notify pgrst, 'reload schema';

-- Verificacion rapida ---------------------------------------------------------
-- (Se lee el catalogo: enum_range no puede usar 'FINE' en la misma transaccion.)
select e.enumlabel as tipos_de_pago
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'tribuia' and t.typname = 'payment_kind'
 order by e.enumsortorder;
