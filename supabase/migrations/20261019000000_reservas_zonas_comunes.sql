-- ============================================================================
-- EdiFeasy :: Reservas de zonas comunes con fecha y pago
-- ----------------------------------------------------------------------------
--   A. common_areas: zonas que la administracion habilita (salon social, BBQ,
--      piscina...) con precio, horario, duracion maxima y aprobacion.
--   B. reservations: reservas por apartamento. Un trigger valida horario,
--      duracion, aforo y cruces (con bloqueo por zona) y fija el valor y el
--      estado inicial; el navegador no decide ni el precio ni el estado.
--   C. Cambios de estado solo por RPC: review_reservation (aprobar/rechazar),
--      register_reservation_payment (pago en la administracion) y
--      cancel_reservation. common_area_busy_slots expone solo horarios ocupados.
--   D. Pago en linea con Wompi: payment_kind 'RESERVATION' y
--      apply_payment_result confirma la reserva al aprobarse el pago.
--   E. Modulo configurable 'reservations'.
--
-- Estados: PENDING_APPROVAL -> PENDING_PAYMENT -> CONFIRMED
--          (o REJECTED / CANCELLED). Sin valor ni aprobacion: CONFIRMED.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase. Despues,
-- re-desplegar la Edge Function `wompi-payments`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ZONAS COMUNES
-- ----------------------------------------------------------------------------
create table if not exists tribuia.common_areas (
  id                uuid primary key default gen_random_uuid(),
  condominium_id    uuid not null references tribuia.condominiums (id) on delete cascade,
  name              text not null,
  description       text,
  rules             text,
  price             numeric(14, 2) not null default 0,
  capacity          integer,
  open_time         time not null default '08:00',
  close_time        time not null default '22:00',
  max_hours         integer not null default 4,
  requires_approval boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint common_areas_name_key unique (condominium_id, name),
  constraint common_areas_name_check check (length(btrim(name)) between 2 and 80),
  constraint common_areas_price_check check (price >= 0 and price <= 50000000),
  constraint common_areas_capacity_check check (capacity is null or capacity between 1 and 5000),
  constraint common_areas_hours_check check (close_time > open_time),
  constraint common_areas_max_hours_check check (max_hours between 1 and 24),
  constraint common_areas_lengths_check check (
    coalesce(length(description), 0) <= 500 and coalesce(length(rules), 0) <= 2000
  )
);

comment on table tribuia.common_areas is
  'Zonas comunes reservables. Horarios en hora de Colombia (America/Bogota).';

drop trigger if exists trg_common_areas_updated_at on tribuia.common_areas;
create trigger trg_common_areas_updated_at before update on tribuia.common_areas
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_common_areas_lock_tenant on tribuia.common_areas;
create trigger trg_common_areas_lock_tenant before update on tribuia.common_areas
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id');
drop trigger if exists trg_audit_common_areas on tribuia.common_areas;
create trigger trg_audit_common_areas after insert or update or delete on tribuia.common_areas
  for each row execute function tribuia.fn_audit('CREATE');


-- ----------------------------------------------------------------------------
-- B. RESERVAS
-- ----------------------------------------------------------------------------
create table if not exists tribuia.reservations (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  -- Sin cascada: una zona con reservas no se borra (se desactiva).
  common_area_id  uuid not null references tribuia.common_areas (id),
  apartment_id    uuid not null references tribuia.apartments (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  guests          integer,
  notes           text,
  status          text not null default 'PENDING_APPROVAL',
  amount          numeric(14, 2) not null default 0,
  payment_method  text,
  paid_at         timestamptz,
  payment_id      uuid references tribuia.payments (id) on delete set null,
  admin_notes     text,
  reviewed_by     uuid references tribuia.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_by      uuid references tribuia.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reservations_range_check check (ends_at > starts_at),
  constraint reservations_status_check check (status in (
    'PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'REJECTED', 'CANCELLED'
  )),
  constraint reservations_payment_method_check check (
    payment_method is null or payment_method in ('ONLINE', 'ON_SITE')
  ),
  constraint reservations_guests_check check (guests is null or guests between 0 and 5000),
  constraint reservations_lengths_check check (
    coalesce(length(notes), 0) <= 500 and coalesce(length(admin_notes), 0) <= 500
  )
);

create index if not exists idx_reservations_area_time
  on tribuia.reservations (common_area_id, starts_at);
create index if not exists idx_reservations_condominium
  on tribuia.reservations (condominium_id, starts_at desc);
create index if not exists idx_reservations_apartment on tribuia.reservations (apartment_id);
create index if not exists idx_reservations_created_by on tribuia.reservations (created_by);
create index if not exists idx_reservations_reviewed_by on tribuia.reservations (reviewed_by);
create index if not exists idx_reservations_payment on tribuia.reservations (payment_id);

drop trigger if exists trg_reservations_updated_at on tribuia.reservations;
create trigger trg_reservations_updated_at before update on tribuia.reservations
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_reservations_lock_tenant on tribuia.reservations;
create trigger trg_reservations_lock_tenant before update on tribuia.reservations
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id', 'apartment_id', 'common_area_id');
drop trigger if exists trg_reservations_tenant_ref on tribuia.reservations;
create trigger trg_reservations_tenant_ref before insert or update on tribuia.reservations
  for each row execute function tribuia.tg_assert_tenant_reference();
drop trigger if exists trg_audit_reservations on tribuia.reservations;
create trigger trg_audit_reservations after insert or update or delete on tribuia.reservations
  for each row execute function tribuia.fn_audit('CREATE');

-- Estados que ocupan el horario.
create or replace function tribuia.reservation_blocks_slot(p_status text)
returns boolean
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select p_status in ('PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED');
$$;

-- Valida y completa la reserva al crearla.
create or replace function tribuia.tg_reservation_before_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_area        tribuia.common_areas%rowtype;
  v_local_start timestamp;
  v_local_end   timestamp;
begin
  -- Serializa las reservas de la misma zona para que dos personas no tomen el
  -- mismo horario al mismo tiempo.
  perform pg_advisory_xact_lock(hashtextextended('reservation:' || new.common_area_id::text, 0));

  select * into v_area from tribuia.common_areas where id = new.common_area_id;
  if v_area.id is null or v_area.condominium_id <> new.condominium_id then
    raise exception 'La zona comun no pertenece a este conjunto' using errcode = '23503';
  end if;
  if not v_area.is_active then
    raise exception 'La zona "%" no esta disponible para reservas', v_area.name using errcode = 'P0001';
  end if;

  if new.starts_at <= now() then
    raise exception 'La reserva debe ser para una fecha futura' using errcode = '22023';
  end if;
  if new.starts_at > now() + interval '180 days' then
    raise exception 'Solo se puede reservar con hasta 6 meses de anticipacion' using errcode = '22023';
  end if;
  if new.ends_at - new.starts_at > make_interval(hours => v_area.max_hours) then
    raise exception 'La zona "%" se reserva maximo % hora(s)', v_area.name, v_area.max_hours
      using errcode = '22023';
  end if;

  v_local_start := new.starts_at at time zone 'America/Bogota';
  v_local_end := new.ends_at at time zone 'America/Bogota';
  if v_local_start::date <> v_local_end::date
     or v_local_start::time < v_area.open_time
     or v_local_end::time > v_area.close_time then
    raise exception 'El horario de "%" es de % a %', v_area.name,
      to_char(v_area.open_time, 'HH24:MI'), to_char(v_area.close_time, 'HH24:MI')
      using errcode = '22023';
  end if;

  if v_area.capacity is not null and coalesce(new.guests, 0) > v_area.capacity then
    raise exception 'La zona "%" tiene un aforo de % personas', v_area.name, v_area.capacity
      using errcode = '22023';
  end if;

  if exists (
    select 1 from tribuia.reservations r
     where r.common_area_id = new.common_area_id
       and tribuia.reservation_blocks_slot(r.status)
       and r.starts_at < new.ends_at
       and r.ends_at > new.starts_at
  ) then
    raise exception 'Ese horario ya esta reservado. Elige otro.' using errcode = '23P01';
  end if;

  -- Valor y estado los fija la base, no el navegador.
  new.amount := v_area.price;
  new.status := case
    when v_area.requires_approval then 'PENDING_APPROVAL'
    when v_area.price > 0 then 'PENDING_PAYMENT'
    else 'CONFIRMED'
  end;
  new.payment_method := null;
  new.paid_at := null;
  new.payment_id := null;
  new.admin_notes := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_reservations_before_insert on tribuia.reservations;
create trigger trg_reservations_before_insert before insert on tribuia.reservations
  for each row execute function tribuia.tg_reservation_before_insert();

revoke execute on function tribuia.tg_reservation_before_insert() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- C. RLS Y RPC
-- ----------------------------------------------------------------------------
alter table tribuia.common_areas enable row level security;
alter table tribuia.reservations enable row level security;

drop policy if exists common_areas_select on tribuia.common_areas;
create policy common_areas_select on tribuia.common_areas for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (is_active or tribuia.is_condominium_admin(condominium_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('reservations'))
  );
drop policy if exists common_areas_insert on tribuia.common_areas;
create policy common_areas_insert on tribuia.common_areas for insert to authenticated
  with check (tribuia.is_condominium_admin(condominium_id));
drop policy if exists common_areas_update on tribuia.common_areas;
create policy common_areas_update on tribuia.common_areas for update to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));
drop policy if exists common_areas_delete on tribuia.common_areas;
create policy common_areas_delete on tribuia.common_areas for delete to authenticated
  using (tribuia.is_condominium_admin(condominium_id));

-- Ven la reserva: la administracion, voceros y seguridad (control de acceso),
-- y quienes viven en el apartamento.
drop policy if exists reservations_select on tribuia.reservations;
create policy reservations_select on tribuia.reservations for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('reservations'))
  );

-- Reservan quienes viven en el apartamento, o la administracion a nombre de uno.
drop policy if exists reservations_insert on tribuia.reservations;
create policy reservations_insert on tribuia.reservations for insert to authenticated
  with check (
    (
      apartment_id in (select tribuia.user_apartment_ids())
      or tribuia.is_condominium_admin(condominium_id)
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('reservations'))
  );
-- Sin politicas de update/delete: los cambios de estado van por las RPC.

revoke all on tribuia.common_areas, tribuia.reservations from anon;
grant select, insert, update, delete on tribuia.common_areas to authenticated;
grant select, insert on tribuia.reservations to authenticated;
grant all on tribuia.common_areas, tribuia.reservations to service_role;


-- Horarios ocupados de una zona (sin datos de quien reservo).
create or replace function tribuia.common_area_busy_slots(
  p_area uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz, status text)
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_condo uuid;
begin
  select condominium_id into v_condo from tribuia.common_areas where id = p_area;
  if v_condo is null
     or not tribuia.user_can_access_condominium(v_condo)
     or not tribuia.module_enabled(v_condo, 'reservations') then
    raise exception 'No tienes acceso a esta zona comun' using errcode = '42501';
  end if;
  if p_to - p_from > interval '62 days' then
    raise exception 'Consulta maximo 62 dias' using errcode = '22023';
  end if;

  return query
    select r.starts_at, r.ends_at, r.status
      from tribuia.reservations r
     where r.common_area_id = p_area
       and tribuia.reservation_blocks_slot(r.status)
       and r.starts_at < p_to
       and r.ends_at > p_from
     order by r.starts_at;
end;
$$;


-- Aprobar o rechazar (administracion).
create or replace function tribuia.review_reservation(
  p_reservation uuid,
  p_approve     boolean,
  p_notes       text default null
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_res tribuia.reservations%rowtype;
begin
  select * into v_res from tribuia.reservations where id = p_reservation for update;
  if v_res.id is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;
  if not tribuia.is_condominium_admin(v_res.condominium_id) then
    raise exception 'Solo la administracion puede revisar reservas' using errcode = '42501';
  end if;
  if v_res.status <> 'PENDING_APPROVAL' then
    raise exception 'Esta reserva ya fue revisada' using errcode = 'P0001';
  end if;

  update tribuia.reservations
     set status = case
           when not p_approve then 'REJECTED'
           when amount > 0 then 'PENDING_PAYMENT'
           else 'CONFIRMED'
         end,
         admin_notes = nullif(btrim(coalesce(p_notes, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_reservation
  returning status into v_res.status;

  return v_res.status;
end;
$$;


-- Pago recibido en la administracion (efectivo o transferencia).
create or replace function tribuia.register_reservation_payment(p_reservation uuid)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_res tribuia.reservations%rowtype;
begin
  select * into v_res from tribuia.reservations where id = p_reservation for update;
  if v_res.id is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;
  if not tribuia.is_condominium_admin(v_res.condominium_id) then
    raise exception 'Solo la administracion registra pagos' using errcode = '42501';
  end if;
  if v_res.status <> 'PENDING_PAYMENT' then
    raise exception 'Esta reserva no tiene un pago pendiente' using errcode = 'P0001';
  end if;

  update tribuia.reservations
     set status = 'CONFIRMED', payment_method = 'ON_SITE', paid_at = now()
   where id = p_reservation;
  return 'CONFIRMED';
end;
$$;


-- Cancelar: residentes antes de pagar; la administracion en cualquier estado activo.
create or replace function tribuia.cancel_reservation(
  p_reservation uuid,
  p_reason      text default null
)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_res   tribuia.reservations%rowtype;
  v_admin boolean;
begin
  select * into v_res from tribuia.reservations where id = p_reservation for update;
  if v_res.id is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;

  v_admin := tribuia.is_condominium_admin(v_res.condominium_id);
  if not v_admin and not (v_res.apartment_id in (select tribuia.user_apartment_ids())) then
    raise exception 'No puedes cancelar esta reserva' using errcode = '42501';
  end if;
  if not tribuia.reservation_blocks_slot(v_res.status) then
    raise exception 'Esta reserva ya no esta activa' using errcode = 'P0001';
  end if;
  if not v_admin and v_res.paid_at is not null then
    raise exception 'La reserva ya esta pagada: pide la cancelacion a la administracion'
      using errcode = 'P0001';
  end if;
  if not v_admin and v_res.starts_at <= now() then
    raise exception 'La reserva ya empezo' using errcode = 'P0001';
  end if;

  update tribuia.reservations
     set status = 'CANCELLED',
         admin_notes = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), admin_notes)
   where id = p_reservation;
  return 'CANCELLED';
end;
$$;

revoke all on function tribuia.common_area_busy_slots(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function tribuia.review_reservation(uuid, boolean, text) from public, anon;
revoke all on function tribuia.register_reservation_payment(uuid) from public, anon;
revoke all on function tribuia.cancel_reservation(uuid, text) from public, anon;
grant execute on function tribuia.reservation_blocks_slot(text) to authenticated, service_role;
grant execute on function tribuia.common_area_busy_slots(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function tribuia.review_reservation(uuid, boolean, text) to authenticated, service_role;
grant execute on function tribuia.register_reservation_payment(uuid) to authenticated, service_role;
grant execute on function tribuia.cancel_reservation(uuid, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- D. PAGO EN LINEA
-- ----------------------------------------------------------------------------
alter type tribuia.payment_kind add value if not exists 'RESERVATION';

alter table tribuia.payments
  add column if not exists reservation_id uuid references tribuia.reservations (id) on delete set null;
create index if not exists idx_payments_reservation on tribuia.payments (reservation_id);

-- 'RESERVATION' se compara como texto: se agrega al enum en esta misma transaccion.
alter table tribuia.payments drop constraint if exists payments_target_check;
alter table tribuia.payments add constraint payments_target_check check (
  (kind::text = 'ADMIN_FEE' and admin_fee_id is not null)
  or (kind::text = 'SUBSCRIPTION' and plan_period is not null)
  or (kind::text = 'FINE' and fine_id is not null)
  or (kind::text = 'RESERVATION' and reservation_id is not null)
);

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
    if v_payment.kind::text = 'ADMIN_FEE' then
      update tribuia.admin_fees
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.admin_fee_id;
    elsif v_payment.kind::text = 'FINE' then
      update tribuia.fines
         set status = 'PAID', paid_at = now(), payment_method = 'WOMPI', payment_id = v_payment.id
       where id = v_payment.fine_id;
    elsif v_payment.kind::text = 'RESERVATION' then
      -- Si la reserva se cancelo mientras se pagaba, queda el pago aprobado para
      -- que la administracion lo devuelva; la reserva no se reactiva.
      update tribuia.reservations
         set status = case when status = 'PENDING_PAYMENT' then 'CONFIRMED' else status end,
             paid_at = now(), payment_method = 'ONLINE', payment_id = v_payment.id
       where id = v_payment.reservation_id;
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


-- ----------------------------------------------------------------------------
-- E. MODULO 'reservations'
-- ----------------------------------------------------------------------------
alter table tribuia.role_modules drop constraint if exists role_modules_module_check;
alter table tribuia.role_modules add constraint role_modules_module_check check (module in (
  'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
  'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
  'marketplace', 'reservations'
));

create or replace function tribuia.role_module_codes()
returns text[]
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select array[
    'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
    'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
    'marketplace', 'reservations'
  ]::text[];
$$;

notify pgrst, 'reload schema';
