-- ============================================================================
-- EdiFeasy :: Alarmas conectadas por unidad e integraciones contables
-- ----------------------------------------------------------------------------
-- A. ALARMAS
--    Cada casa o apartamento (o zona comun) registra una o varias alarmas de
--    cualquier marca. Cada alarma tiene una URL secreta propia: el panel, la app
--    del fabricante o la central de monitoreo envia ahi sus eventos y la Edge
--    Function `alarm-webhook` los normaliza y llama a record_alarm_event().
--    Se guarda solo el hash del token. Segun el tipo de evento:
--      - Panico, intrusion, medico: alerta a porteria, administracion y la unidad.
--      - Incendio y gas: alerta a toda la torre o bloque.
--      - Inundacion: alerta (alta) a porteria, administracion y la unidad.
--      - Coaccion: aviso silencioso solo a porteria y administracion.
--      - Fallas tecnicas (sabotaje, bateria, energia, comunicacion): solo
--        porteria y administracion.
--      - Armado, desarmado, restauraciones y pruebas: solo historial.
--
-- B. CONTABILIDAD
--    Conexiones con sistemas contables (Siigo y Alegra por API; World Office,
--    Helisa, ContaPyme u otros por archivo). Las credenciales viven en una tabla
--    que solo lee el servidor. Toda la informacion entra por un unico camino,
--    import_accounting_data(), y queda normalizada en:
--      estado de cuenta por unidad, movimientos, estados financieros,
--      ejecucion presupuestal y cartera del conjunto.
--    Las tablas estan en Realtime: la app se actualiza al sincronizar.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- A. ALARMAS
-- ============================================================================

create table if not exists tribuia.alarm_devices (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id    uuid references tribuia.apartments (id) on delete cascade,
  building_id     uuid references tribuia.buildings (id) on delete set null,
  name            text not null,
  provider        text not null default 'GENERIC',
  location        text,
  notes           text,
  token_hash      text not null,
  token_hint      text not null,
  is_active       boolean not null default true,
  armed_state     text,
  last_event_at   timestamptz,
  last_event_type text,
  created_by      uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint alarm_devices_name_check check (length(btrim(name)) between 2 and 80),
  constraint alarm_devices_provider_check check (provider in (
    'GENERIC', 'AJAX', 'HIKVISION', 'DAHUA', 'PARADOX', 'DSC', 'HONEYWELL',
    'TEXECOM', 'MONITORING_CENTER', 'OTHER'
  )),
  constraint alarm_devices_armed_check check (armed_state is null or armed_state in ('ARMED', 'DISARMED', 'PARTIAL')),
  constraint alarm_devices_token_hash_key unique (token_hash)
);

comment on table tribuia.alarm_devices is
  'Alarmas conectadas por unidad (o zona comun si apartment_id es null). Solo se guarda el hash del token del webhook.';

create index if not exists idx_alarm_devices_condominium on tribuia.alarm_devices (condominium_id);
create index if not exists idx_alarm_devices_apartment on tribuia.alarm_devices (apartment_id);
create index if not exists idx_alarm_devices_building on tribuia.alarm_devices (building_id);
create index if not exists idx_alarm_devices_created_by on tribuia.alarm_devices (created_by);

create table if not exists tribuia.alarm_events (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  device_id       uuid not null references tribuia.alarm_devices (id) on delete cascade,
  apartment_id    uuid references tribuia.apartments (id) on delete set null,
  building_id     uuid references tribuia.buildings (id) on delete set null,
  event_type      text not null,
  severity        text not null,
  zone            text,
  raw_code        text,
  message         text,
  occurred_at     timestamptz not null default now(),
  received_at     timestamptz not null default now(),
  payload         jsonb not null default '{}'::jsonb,
  alert_id        uuid references tribuia.alerts (id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references tribuia.profiles (id) on delete set null,
  resolution_note text,
  constraint alarm_events_type_check check (event_type in (
    'PANIC', 'FIRE', 'INTRUSION', 'MEDICAL', 'GAS', 'FLOOD', 'DURESS',
    'TAMPER', 'LOW_BATTERY', 'POWER_FAILURE', 'COMMUNICATION_FAILURE',
    'ARMED', 'DISARMED', 'PARTIAL_ARMED', 'ALARM_RESTORED', 'POWER_RESTORED',
    'TEST', 'OTHER'
  )),
  constraint alarm_events_severity_check check (severity in ('CRITICAL', 'HIGH', 'TECHNICAL', 'INFO'))
);

create index if not exists idx_alarm_events_condominium on tribuia.alarm_events (condominium_id, received_at desc);
create index if not exists idx_alarm_events_device on tribuia.alarm_events (device_id, received_at desc);
create index if not exists idx_alarm_events_apartment on tribuia.alarm_events (apartment_id);
create index if not exists idx_alarm_events_building on tribuia.alarm_events (building_id);
create index if not exists idx_alarm_events_alert on tribuia.alarm_events (alert_id);
create index if not exists idx_alarm_events_ack_by on tribuia.alarm_events (acknowledged_by);

drop trigger if exists trg_alarm_devices_updated_at on tribuia.alarm_devices;
create trigger trg_alarm_devices_updated_at before update on tribuia.alarm_devices
  for each row execute function tribuia.set_updated_at();

alter table tribuia.alarm_devices enable row level security;
alter table tribuia.alarm_events enable row level security;

-- Lectura: porteria, administracion y vocero ven todo el conjunto; cada
-- residente ve las alarmas y eventos de su unidad. Escritura solo por RPC.
drop policy if exists alarm_devices_select on tribuia.alarm_devices;
create policy alarm_devices_select on tribuia.alarm_devices for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('alarms'))
  );

drop policy if exists alarm_events_select on tribuia.alarm_events;
create policy alarm_events_select on tribuia.alarm_events for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or apartment_id in (select tribuia.user_apartment_ids())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('alarms'))
  );

-- El hash del token no se expone al navegador (permiso por columnas).
revoke all on tribuia.alarm_devices from anon, authenticated;
grant select (
  id, condominium_id, apartment_id, building_id, name, provider, location, notes,
  token_hint, is_active, armed_state, last_event_at, last_event_type,
  created_by, created_at, updated_at
) on tribuia.alarm_devices to authenticated;
revoke all on tribuia.alarm_events from anon, authenticated;
grant select on tribuia.alarm_events to authenticated;
grant all on tribuia.alarm_devices, tribuia.alarm_events to service_role;

-- Quien puede administrar una alarma: la administracion del conjunto o el
-- propietario de la unidad (no las de zonas comunes).
create or replace function tribuia.can_manage_alarm(p_condominium uuid, p_apartment uuid)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.is_condominium_admin(p_condominium)
      or (p_apartment is not null and tribuia.user_owns_apartment(p_apartment));
$$;

-- Token aleatorio de 64 hex (dos UUID v4: ~244 bits) y su hash.
create or replace function tribuia.new_alarm_token()
returns text
language sql
volatile
set search_path = tribuia, public, pg_temp
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function tribuia.alarm_token_hash(p_token text)
returns text
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function tribuia.create_alarm_device(
  p_condominium uuid,
  p_apartment uuid,
  p_name text,
  p_provider text default 'GENERIC',
  p_location text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_building uuid;
  v_token    text := tribuia.new_alarm_token();
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if not tribuia.can_manage_alarm(p_condominium, p_apartment) then
    raise exception 'Solo la administracion o el propietario de la unidad pueden conectar alarmas' using errcode = '42501';
  end if;
  if p_apartment is not null then
    select a.building_id into v_building
      from tribuia.apartments a
     where a.id = p_apartment and a.condominium_id = p_condominium;
    if not found then
      raise exception 'La unidad no pertenece a este conjunto' using errcode = 'P0001';
    end if;
  end if;

  insert into tribuia.alarm_devices
    (condominium_id, apartment_id, building_id, name, provider, location, notes, token_hash, token_hint)
  values (
    p_condominium, p_apartment, v_building, btrim(p_name), coalesce(nullif(p_provider, ''), 'GENERIC'),
    nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
    tribuia.alarm_token_hash(v_token), right(v_token, 4)
  )
  returning id into v_id;

  -- El token solo se entrega aqui; despues no se puede volver a leer.
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

create or replace function tribuia.rotate_alarm_device_token(p_device uuid)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_device tribuia.alarm_devices%rowtype;
  v_token  text := tribuia.new_alarm_token();
begin
  select * into v_device from tribuia.alarm_devices where id = p_device;
  if not found then
    raise exception 'La alarma no existe' using errcode = 'P0002';
  end if;
  if not tribuia.can_manage_alarm(v_device.condominium_id, v_device.apartment_id) then
    raise exception 'No puedes administrar esta alarma' using errcode = '42501';
  end if;
  update tribuia.alarm_devices
     set token_hash = tribuia.alarm_token_hash(v_token), token_hint = right(v_token, 4)
   where id = p_device;
  return v_token;
end;
$$;

create or replace function tribuia.update_alarm_device(
  p_device uuid,
  p_name text,
  p_provider text,
  p_location text,
  p_notes text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_device tribuia.alarm_devices%rowtype;
begin
  select * into v_device from tribuia.alarm_devices where id = p_device;
  if not found then
    raise exception 'La alarma no existe' using errcode = 'P0002';
  end if;
  if not tribuia.can_manage_alarm(v_device.condominium_id, v_device.apartment_id) then
    raise exception 'No puedes administrar esta alarma' using errcode = '42501';
  end if;
  update tribuia.alarm_devices
     set name = btrim(p_name),
         provider = coalesce(nullif(p_provider, ''), provider),
         location = nullif(btrim(coalesce(p_location, '')), ''),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         is_active = coalesce(p_is_active, is_active)
   where id = p_device;
  return p_device;
end;
$$;

create or replace function tribuia.delete_alarm_device(p_device uuid)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_device tribuia.alarm_devices%rowtype;
begin
  select * into v_device from tribuia.alarm_devices where id = p_device;
  if not found then
    raise exception 'La alarma no existe' using errcode = 'P0002';
  end if;
  if not tribuia.can_manage_alarm(v_device.condominium_id, v_device.apartment_id) then
    raise exception 'No puedes administrar esta alarma' using errcode = '42501';
  end if;
  delete from tribuia.alarm_devices where id = p_device;
  return p_device;
end;
$$;

-- Severidad por tipo de evento (unica fuente de verdad).
create or replace function tribuia.alarm_event_severity(p_type text)
returns text
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select case
    when p_type in ('PANIC', 'FIRE', 'INTRUSION', 'MEDICAL', 'GAS', 'DURESS') then 'CRITICAL'
    when p_type = 'FLOOD' then 'HIGH'
    when p_type in ('TAMPER', 'LOW_BATTERY', 'POWER_FAILURE', 'COMMUNICATION_FAILURE') then 'TECHNICAL'
    else 'INFO'
  end;
$$;

-- Registro de un evento. Solo la Edge Function (service role) lo llama, con el
-- hash del token y el evento ya normalizado:
--   { event_type, zone?, raw_code?, message?, occurred_at?, payload? }
create or replace function tribuia.record_alarm_event(p_token_hash text, p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_device   tribuia.alarm_devices%rowtype;
  v_type     text := upper(coalesce(p_event ->> 'event_type', 'OTHER'));
  v_zone     text := left(nullif(btrim(coalesce(p_event ->> 'zone', '')), ''), 80);
  v_code     text := left(nullif(btrim(coalesce(p_event ->> 'raw_code', '')), ''), 40);
  v_message  text := left(nullif(btrim(coalesce(p_event ->> 'message', '')), ''), 300);
  v_when     timestamptz;
  v_severity text;
  v_event    uuid;
  v_alert    uuid;
  v_dup      uuid;
  v_unit     text;
  v_label    text;
  v_title    text;
  v_audience tribuia.audience_type;
  v_alert_t  tribuia.alert_type;
begin
  select * into v_device from tribuia.alarm_devices where token_hash = p_token_hash;
  if not found or not v_device.is_active then
    raise exception 'Alarma no registrada o desactivada' using errcode = 'P0002';
  end if;

  if v_type not in (
    'PANIC', 'FIRE', 'INTRUSION', 'MEDICAL', 'GAS', 'FLOOD', 'DURESS',
    'TAMPER', 'LOW_BATTERY', 'POWER_FAILURE', 'COMMUNICATION_FAILURE',
    'ARMED', 'DISARMED', 'PARTIAL_ARMED', 'ALARM_RESTORED', 'POWER_RESTORED', 'TEST', 'OTHER'
  ) then
    v_type := 'OTHER';
  end if;
  v_severity := tribuia.alarm_event_severity(v_type);

  -- Hora del panel solo si es razonable (relojes de paneles suelen estar mal).
  begin
    v_when := (p_event ->> 'occurred_at')::timestamptz;
  exception when others then
    v_when := null;
  end;
  if v_when is null or v_when > now() + interval '5 minutes' or v_when < now() - interval '1 day' then
    v_when := now();
  end if;

  -- Los paneles reintentan: el mismo evento en la misma zona en 60 s no se duplica.
  select e.id into v_dup
    from tribuia.alarm_events e
   where e.device_id = v_device.id
     and e.event_type = v_type
     and e.zone is not distinct from v_zone
     and e.received_at > now() - interval '60 seconds'
   order by e.received_at desc
   limit 1;
  if v_dup is not null then
    return jsonb_build_object('event_id', v_dup, 'duplicate', true);
  end if;

  insert into tribuia.alarm_events
    (condominium_id, device_id, apartment_id, building_id, event_type, severity, zone, raw_code, message, occurred_at, payload)
  values (
    v_device.condominium_id, v_device.id, v_device.apartment_id, v_device.building_id,
    v_type, v_severity, v_zone, v_code, v_message, v_when,
    case when pg_column_size(p_event -> 'payload') <= 8000 then coalesce(p_event -> 'payload', '{}'::jsonb) else '{}'::jsonb end
  )
  returning id into v_event;

  update tribuia.alarm_devices
     set last_event_at = now(),
         last_event_type = v_type,
         armed_state = case v_type
           when 'ARMED' then 'ARMED'
           when 'DISARMED' then 'DISARMED'
           when 'PARTIAL_ARMED' then 'PARTIAL'
           else armed_state
         end
   where id = v_device.id;

  -- Nombre de la unidad para los mensajes ("Torre 1 · 301" o la ubicacion).
  select b.name || ' · ' || a.number into v_unit
    from tribuia.apartments a
    join tribuia.buildings b on b.id = a.building_id
   where a.id = v_device.apartment_id;
  v_unit := coalesce(v_unit, v_device.location, 'Zona comun');
  v_label := case v_type
    when 'PANIC' then 'Boton de panico'
    when 'FIRE' then 'Alarma de incendio'
    when 'INTRUSION' then 'Intrusion detectada'
    when 'MEDICAL' then 'Emergencia medica'
    when 'GAS' then 'Fuga de gas'
    when 'FLOOD' then 'Inundacion detectada'
    when 'DURESS' then 'Codigo de coaccion'
    when 'TAMPER' then 'Sabotaje del panel'
    when 'LOW_BATTERY' then 'Bateria baja'
    when 'POWER_FAILURE' then 'Falla de energia'
    when 'COMMUNICATION_FAILURE' then 'Falla de comunicacion'
    else v_type
  end;
  v_title := v_label || ' · ' || v_unit;

  if v_severity in ('CRITICAL', 'HIGH') and v_type <> 'DURESS' then
    v_audience := case
      when v_type in ('FIRE', 'GAS') and v_device.building_id is not null then 'BUILDING'::tribuia.audience_type
      else 'APARTMENT'::tribuia.audience_type
    end;
    v_alert_t := case v_type
      when 'FIRE' then 'EMERGENCY'::tribuia.alert_type
      when 'MEDICAL' then 'EMERGENCY'::tribuia.alert_type
      when 'GAS' then 'GAS'::tribuia.alert_type
      when 'FLOOD' then 'WATER'::tribuia.alert_type
      else 'SECURITY'::tribuia.alert_type
    end;
    -- La alerta dispara las notificaciones (trg_alerts_notify): porteria,
    -- administracion y vocero siempre; ademas la unidad o la torre segun el tipo.
    insert into tribuia.alerts
      (condominium_id, building_id, apartment_id, title, description, type, priority, status, audience)
    values (
      v_device.condominium_id, v_device.building_id, v_device.apartment_id,
      v_title,
      coalesce(v_message, v_label) || coalesce(' (zona ' || v_zone || ')', '') ||
        '. Alarma: ' || v_device.name || '.',
      v_alert_t,
      case when v_severity = 'CRITICAL' then 'CRITICAL'::tribuia.priority_level else 'HIGH'::tribuia.priority_level end,
      'ACTIVE',
      v_audience
    )
    returning id into v_alert;
    update tribuia.alarm_events set alert_id = v_alert where id = v_event;
  elsif v_severity = 'TECHNICAL' or v_type = 'DURESS' then
    -- Silencioso: solo porteria y administracion (en coaccion nunca a la unidad).
    insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select distinct v_device.condominium_id, m.user_id, v_title,
           coalesce(v_message, v_label) || '. Alarma: ' || v_device.name || '.',
           'ALERT'::tribuia.notification_type,
           case when v_type = 'DURESS' then 'CRITICAL'::tribuia.priority_level else 'MEDIUM'::tribuia.priority_level end,
           'alarm_events', v_event, '/alarms'
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id
     where m.condominium_id = v_device.condominium_id
       and m.status = 'ACTIVE'
       and r.code in ('ADMINISTRATOR', 'SECURITY');
  end if;

  return jsonb_build_object('event_id', v_event, 'alert_id', v_alert, 'severity', v_severity, 'duplicate', false);
end;
$$;

-- Prueba desde la app: registra un evento TEST (verifica permisos y la vista;
-- la conexion real del panel se prueba enviando un evento a la URL).
create or replace function tribuia.test_alarm_device(p_device uuid)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_device tribuia.alarm_devices%rowtype;
  v_event  uuid;
begin
  select * into v_device from tribuia.alarm_devices where id = p_device;
  if not found then
    raise exception 'La alarma no existe' using errcode = 'P0002';
  end if;
  if not tribuia.can_manage_alarm(v_device.condominium_id, v_device.apartment_id) then
    raise exception 'No puedes administrar esta alarma' using errcode = '42501';
  end if;
  insert into tribuia.alarm_events
    (condominium_id, device_id, apartment_id, building_id, event_type, severity, message, payload)
  values (v_device.condominium_id, v_device.id, v_device.apartment_id, v_device.building_id,
          'TEST', 'INFO', 'Prueba desde EdiFeasy', jsonb_build_object('source', 'app', 'by', auth.uid()))
  returning id into v_event;
  update tribuia.alarm_devices set last_event_at = now(), last_event_type = 'TEST' where id = p_device;
  return v_event;
end;
$$;

-- Atender un evento: porteria/administracion, o el propietario de la unidad.
create or replace function tribuia.acknowledge_alarm_event(p_event uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.alarm_events%rowtype;
begin
  select * into v_row from tribuia.alarm_events where id = p_event;
  if not found then
    raise exception 'El evento no existe' using errcode = 'P0002';
  end if;
  if not (
    tribuia.has_role(v_row.condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    or (v_row.apartment_id is not null and tribuia.user_owns_apartment(v_row.apartment_id))
  ) then
    raise exception 'No puedes atender este evento' using errcode = '42501';
  end if;
  update tribuia.alarm_events
     set acknowledged_at = now(),
         acknowledged_by = auth.uid(),
         resolution_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
   where id = p_event;
  -- Si genero una alerta, se marca resuelta.
  if v_row.alert_id is not null then
    update tribuia.alerts set status = 'RESOLVED', end_at = now()
     where id = v_row.alert_id and status = 'ACTIVE';
  end if;
  return p_event;
end;
$$;

revoke all on function tribuia.can_manage_alarm(uuid, uuid) from public, anon;
revoke all on function tribuia.new_alarm_token() from public, anon, authenticated;
revoke all on function tribuia.alarm_token_hash(text) from public, anon, authenticated;
revoke all on function tribuia.create_alarm_device(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function tribuia.rotate_alarm_device_token(uuid) from public, anon;
revoke all on function tribuia.update_alarm_device(uuid, text, text, text, text, boolean) from public, anon;
revoke all on function tribuia.delete_alarm_device(uuid) from public, anon;
revoke all on function tribuia.record_alarm_event(text, jsonb) from public, anon, authenticated;
revoke all on function tribuia.test_alarm_device(uuid) from public, anon;
revoke all on function tribuia.acknowledge_alarm_event(uuid, text) from public, anon;
grant execute on function tribuia.can_manage_alarm(uuid, uuid) to authenticated, service_role;
grant execute on function tribuia.new_alarm_token() to service_role;
grant execute on function tribuia.alarm_token_hash(text) to service_role;
grant execute on function tribuia.alarm_event_severity(text) to authenticated, service_role;
grant execute on function tribuia.create_alarm_device(uuid, uuid, text, text, text, text) to authenticated, service_role;
grant execute on function tribuia.rotate_alarm_device_token(uuid) to authenticated, service_role;
grant execute on function tribuia.update_alarm_device(uuid, text, text, text, text, boolean) to authenticated, service_role;
grant execute on function tribuia.delete_alarm_device(uuid) to authenticated, service_role;
grant execute on function tribuia.record_alarm_event(text, jsonb) to service_role;
grant execute on function tribuia.test_alarm_device(uuid) to authenticated, service_role;
grant execute on function tribuia.acknowledge_alarm_event(uuid, text) to authenticated, service_role;

-- ============================================================================
-- B. CONTABILIDAD
-- ============================================================================

create table if not exists tribuia.accounting_integrations (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  provider       text not null,
  mode           text not null,
  status         text not null default 'PENDING',
  display_name   text,
  settings       jsonb not null default '{}'::jsonb,
  last_sync_at   timestamptz,
  last_error     text,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint accounting_integrations_provider_check check (provider in (
    'SIIGO', 'ALEGRA', 'WORLD_OFFICE', 'HELISA', 'CONTAPYME', 'OTHER'
  )),
  constraint accounting_integrations_mode_check check (mode in ('API', 'FILE')),
  constraint accounting_integrations_status_check check (status in ('PENDING', 'CONNECTED', 'ERROR', 'DISABLED')),
  constraint accounting_integrations_unique unique (condominium_id, provider)
);

create index if not exists idx_accounting_integrations_created_by on tribuia.accounting_integrations (created_by);

-- Credenciales: sin politicas ni permisos para el navegador; solo el servidor.
create table if not exists tribuia.accounting_secrets (
  integration_id uuid primary key references tribuia.accounting_integrations (id) on delete cascade,
  credentials    jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

create table if not exists tribuia.accounting_sync_runs (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  integration_id uuid references tribuia.accounting_integrations (id) on delete set null,
  source         text not null,
  kind           text not null,
  status         text not null,
  stats          jsonb not null default '{}'::jsonb,
  error          text,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint accounting_sync_runs_source_check check (source in ('API', 'FILE')),
  constraint accounting_sync_runs_status_check check (status in ('OK', 'PARTIAL', 'ERROR'))
);

create index if not exists idx_accounting_runs_condominium on tribuia.accounting_sync_runs (condominium_id, created_at desc);
create index if not exists idx_accounting_runs_integration on tribuia.accounting_sync_runs (integration_id);
create index if not exists idx_accounting_runs_created_by on tribuia.accounting_sync_runs (created_by);

-- Codigo de la unidad en el sistema contable cuando no coincide con el de EdiFeasy.
create table if not exists tribuia.accounting_unit_links (
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  external_code  text not null,
  apartment_id   uuid not null references tribuia.apartments (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (condominium_id, external_code)
);

create index if not exists idx_accounting_links_apartment on tribuia.accounting_unit_links (apartment_id);

-- Estado de cuenta vigente de cada unidad.
create table if not exists tribuia.unit_account_statements (
  apartment_id        uuid primary key references tribuia.apartments (id) on delete cascade,
  condominium_id      uuid not null references tribuia.condominiums (id) on delete cascade,
  balance             numeric(14, 2) not null default 0,
  overdue             numeric(14, 2) not null default 0,
  interest            numeric(14, 2) not null default 0,
  last_payment_at     date,
  last_payment_amount numeric(14, 2),
  as_of               date not null default current_date,
  source              text,
  synced_at           timestamptz not null default now()
);

create index if not exists idx_unit_statements_condominium on tribuia.unit_account_statements (condominium_id);

create table if not exists tribuia.unit_account_movements (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  apartment_id   uuid not null references tribuia.apartments (id) on delete cascade,
  external_id    text not null,
  movement_date  date not null,
  document       text,
  concept        text not null,
  debit          numeric(14, 2) not null default 0,
  credit         numeric(14, 2) not null default 0,
  synced_at      timestamptz not null default now(),
  constraint unit_movements_external_unique unique (condominium_id, external_id)
);

create index if not exists idx_unit_movements_apartment on tribuia.unit_account_movements (apartment_id, movement_date desc);

-- Estados financieros por mes: BALANCE (situacion financiera) o RESULTS (resultados).
create table if not exists tribuia.financial_statements (
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  period         date not null,
  kind           text not null,
  lines          jsonb not null default '[]'::jsonb,
  synced_at      timestamptz not null default now(),
  primary key (condominium_id, period, kind),
  constraint financial_statements_kind_check check (kind in ('BALANCE', 'RESULTS'))
);

create table if not exists tribuia.budget_lines (
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  year           integer not null,
  code           text not null,
  name           text not null,
  kind           text not null default 'EXPENSE',
  budget         numeric(14, 2) not null default 0,
  executed       numeric(14, 2) not null default 0,
  synced_at      timestamptz not null default now(),
  primary key (condominium_id, year, code),
  constraint budget_lines_kind_check check (kind in ('INCOME', 'EXPENSE'))
);

-- Cartera del conjunto por fecha (sin datos de unidades).
create table if not exists tribuia.portfolio_snapshots (
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  as_of          date not null,
  total_overdue  numeric(14, 2) not null default 0,
  total_balance  numeric(14, 2) not null default 0,
  units_overdue  integer not null default 0,
  units_total    integer not null default 0,
  synced_at      timestamptz not null default now(),
  primary key (condominium_id, as_of)
);

drop trigger if exists trg_accounting_integrations_updated_at on tribuia.accounting_integrations;
create trigger trg_accounting_integrations_updated_at before update on tribuia.accounting_integrations
  for each row execute function tribuia.set_updated_at();

alter table tribuia.accounting_integrations enable row level security;
alter table tribuia.accounting_secrets enable row level security;
alter table tribuia.accounting_sync_runs enable row level security;
alter table tribuia.accounting_unit_links enable row level security;
alter table tribuia.unit_account_statements enable row level security;
alter table tribuia.unit_account_movements enable row level security;
alter table tribuia.financial_statements enable row level security;
alter table tribuia.budget_lines enable row level security;
alter table tribuia.portfolio_snapshots enable row level security;

-- Conexiones, historial y enlaces de unidades: solo la administracion.
drop policy if exists accounting_integrations_admin on tribuia.accounting_integrations;
create policy accounting_integrations_admin on tribuia.accounting_integrations for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

drop policy if exists accounting_sync_runs_select on tribuia.accounting_sync_runs;
create policy accounting_sync_runs_select on tribuia.accounting_sync_runs for select to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));

drop policy if exists accounting_unit_links_admin on tribuia.accounting_unit_links;
create policy accounting_unit_links_admin on tribuia.accounting_unit_links for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- Estado de cuenta y movimientos: la administracion y el vocero ven todos; cada
-- propietario solo los de sus unidades.
drop policy if exists unit_statements_select on tribuia.unit_account_statements;
create policy unit_statements_select on tribuia.unit_account_statements for select to authenticated
  using (
    (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
     or tribuia.user_owns_apartment(apartment_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists unit_movements_select on tribuia.unit_account_movements;
create policy unit_movements_select on tribuia.unit_account_movements for select to authenticated
  using (
    (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
     or tribuia.user_owns_apartment(apartment_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

-- Informacion del conjunto (Ley 675: los propietarios tienen derecho a ella).
drop policy if exists financial_statements_select on tribuia.financial_statements;
create policy financial_statements_select on tribuia.financial_statements for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists budget_lines_select on tribuia.budget_lines;
create policy budget_lines_select on tribuia.budget_lines for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists portfolio_snapshots_select on tribuia.portfolio_snapshots;
create policy portfolio_snapshots_select on tribuia.portfolio_snapshots for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

revoke all on tribuia.accounting_secrets from anon, authenticated;
grant select, insert, update, delete on tribuia.accounting_integrations to authenticated;
grant select on tribuia.accounting_sync_runs to authenticated;
grant select, insert, update, delete on tribuia.accounting_unit_links to authenticated;
grant select on tribuia.unit_account_statements, tribuia.unit_account_movements,
  tribuia.financial_statements, tribuia.budget_lines, tribuia.portfolio_snapshots to authenticated;
grant all on tribuia.accounting_integrations, tribuia.accounting_secrets, tribuia.accounting_sync_runs,
  tribuia.accounting_unit_links, tribuia.unit_account_statements, tribuia.unit_account_movements,
  tribuia.financial_statements, tribuia.budget_lines, tribuia.portfolio_snapshots to service_role;

-- Codigo de unidad normalizado: "Torre 1 - Apto 301" -> "torre1301".
create or replace function tribuia.normalize_unit_code(p_code text)
returns text
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select regexp_replace(
    regexp_replace(lower(coalesce(p_code, '')), '(apartamento|apto|apt|casa|unidad|local|no\.|#)', '', 'g'),
    '[^a-z0-9]', '', 'g');
$$;

-- Unidad de EdiFeasy para un codigo del sistema contable. Prueba, en orden:
-- enlace manual, bloque+numero (por nombre o numero del bloque) y numero solo
-- (si es unico en el conjunto).
create or replace function tribuia.match_accounting_unit(p_condominium uuid, p_code text)
returns uuid
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_norm text := tribuia.normalize_unit_code(p_code);
  v_id   uuid;
  v_n    integer;
begin
  if v_norm = '' then
    return null;
  end if;

  select l.apartment_id into v_id
    from tribuia.accounting_unit_links l
   where l.condominium_id = p_condominium
     and tribuia.normalize_unit_code(l.external_code) = v_norm
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select a.id into v_id
    from tribuia.apartments a
    join tribuia.buildings b on b.id = a.building_id
   where a.condominium_id = p_condominium
     and v_norm in (
       tribuia.normalize_unit_code(b.name || a.number),
       tribuia.normalize_unit_code(b.number || a.number),
       tribuia.normalize_unit_code('t' || b.number || a.number),
       tribuia.normalize_unit_code(a.number)
     )
   order by (tribuia.normalize_unit_code(a.number) = v_norm)  -- prefiere bloque+numero
   limit 1;
  if v_id is null then
    return null;
  end if;

  -- Si solo coincidio el numero, debe ser unico en el conjunto.
  if exists (select 1 from tribuia.apartments a where a.id = v_id and tribuia.normalize_unit_code(a.number) = v_norm) then
    select count(*) into v_n from tribuia.apartments a
     where a.condominium_id = p_condominium and tribuia.normalize_unit_code(a.number) = v_norm;
    if v_n > 1 then
      return null;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function tribuia.accounting_number(p_value text)
returns numeric
language plpgsql
immutable
set search_path = tribuia, public, pg_temp
as $$
declare
  v text := btrim(coalesce(p_value, ''));
  v_neg boolean := false;
begin
  if v = '' then
    return 0;
  end if;
  if v ~ '^\(.*\)$' then
    v_neg := true;
    v := substr(v, 2, length(v) - 2);
  end if;
  v := regexp_replace(v, '[^0-9,.\-]', '', 'g');
  -- "1.234.567,89" (Colombia) o "1,234,567.89"
  if v ~ ',\d{1,2}$' then
    v := replace(replace(v, '.', ''), ',', '.');
  else
    v := replace(v, ',', '');
    if v ~ '\.\d{3}(\.|$)' and v !~ '\.\d{1,2}$' then
      v := replace(v, '.', '');
    end if;
  end if;
  if v in ('', '-', '.') then
    return 0;
  end if;
  return case when v_neg then -v::numeric else v::numeric end;
exception when others then
  return 0;
end;
$$;

create or replace function tribuia.accounting_date(p_value text)
returns date
language plpgsql
immutable
set search_path = tribuia, public, pg_temp
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if v = '' then
    return null;
  end if;
  if v ~ '^\d{4}-\d{2}-\d{2}' then
    return left(v, 10)::date;
  end if;
  if v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then
    return to_date(v, 'DD/MM/YYYY');
  end if;
  if v ~ '^\d{4}-\d{2}$' then
    return (v || '-01')::date;
  end if;
  return v::date;
exception when others then
  return null;
end;
$$;

-- Unico camino de entrada de la informacion contable (archivo o API).
--   p_kind: UNIT_STATEMENTS | UNIT_MOVEMENTS | FINANCIAL_STATEMENTS | BUDGET
-- Devuelve { imported, skipped, unmatched: [codigos sin unidad] }.
create or replace function tribuia.import_accounting_data(
  p_condominium uuid,
  p_kind text,
  p_rows jsonb,
  p_source text default 'FILE',
  p_integration uuid default null,
  p_as_of date default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row       jsonb;
  v_apt       uuid;
  v_imported  integer := 0;
  v_skipped   integer := 0;
  v_unmatched text[] := '{}';
  v_as_of     date := coalesce(p_as_of, current_date);
  v_code      text;
  v_period    date;
  v_kind      text;
  v_ext       text;
  v_status    text;
  v_result    jsonb;
begin
  if not (tribuia.is_condominium_admin(p_condominium) or auth.role() = 'service_role') then
    raise exception 'Solo la administracion puede cargar informacion contable' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Los datos deben ser una lista de filas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 20000 then
    raise exception 'Maximo 20.000 filas por carga' using errcode = '22023';
  end if;
  if p_kind not in ('UNIT_STATEMENTS', 'UNIT_MOVEMENTS', 'FINANCIAL_STATEMENTS', 'BUDGET') then
    raise exception 'Tipo de informacion no valido: %', p_kind using errcode = '22023';
  end if;

  if p_kind = 'UNIT_STATEMENTS' then
    for v_row in select * from jsonb_array_elements(p_rows) loop
      v_code := v_row ->> 'unit';
      v_apt := tribuia.match_accounting_unit(p_condominium, v_code);
      if v_apt is null then
        v_skipped := v_skipped + 1;
        v_unmatched := array_append(v_unmatched, coalesce(v_code, '(vacio)'));
        continue;
      end if;
      insert into tribuia.unit_account_statements
        (apartment_id, condominium_id, balance, overdue, interest, last_payment_at, last_payment_amount, as_of, source, synced_at)
      values (
        v_apt, p_condominium,
        tribuia.accounting_number(v_row ->> 'balance'),
        tribuia.accounting_number(v_row ->> 'overdue'),
        tribuia.accounting_number(v_row ->> 'interest'),
        tribuia.accounting_date(v_row ->> 'last_payment_date'),
        nullif(tribuia.accounting_number(v_row ->> 'last_payment_amount'), 0),
        v_as_of, p_source, now()
      )
      on conflict (apartment_id) do update set
        balance = excluded.balance, overdue = excluded.overdue, interest = excluded.interest,
        last_payment_at = coalesce(excluded.last_payment_at, tribuia.unit_account_statements.last_payment_at),
        last_payment_amount = coalesce(excluded.last_payment_amount, tribuia.unit_account_statements.last_payment_amount),
        as_of = excluded.as_of, source = excluded.source, synced_at = now();
      v_imported := v_imported + 1;
    end loop;

    -- Cartera del conjunto a la fecha (agregada, sin datos por unidad).
    insert into tribuia.portfolio_snapshots
      (condominium_id, as_of, total_overdue, total_balance, units_overdue, units_total, synced_at)
    select p_condominium, v_as_of,
           coalesce(sum(s.overdue), 0), coalesce(sum(s.balance), 0),
           count(*) filter (where s.overdue > 0), count(*), now()
      from tribuia.unit_account_statements s
     where s.condominium_id = p_condominium
    on conflict (condominium_id, as_of) do update set
      total_overdue = excluded.total_overdue, total_balance = excluded.total_balance,
      units_overdue = excluded.units_overdue, units_total = excluded.units_total, synced_at = now();

  elsif p_kind = 'UNIT_MOVEMENTS' then
    for v_row in select * from jsonb_array_elements(p_rows) loop
      v_code := v_row ->> 'unit';
      v_apt := tribuia.match_accounting_unit(p_condominium, v_code);
      if v_apt is null or tribuia.accounting_date(v_row ->> 'date') is null then
        v_skipped := v_skipped + 1;
        if v_apt is null then
          v_unmatched := array_append(v_unmatched, coalesce(v_code, '(vacio)'));
        end if;
        continue;
      end if;
      v_ext := coalesce(
        nullif(btrim(coalesce(v_row ->> 'external_id', '')), ''),
        md5(concat_ws('|', v_apt, v_row ->> 'date', v_row ->> 'document', v_row ->> 'concept',
                      v_row ->> 'debit', v_row ->> 'credit'))
      );
      insert into tribuia.unit_account_movements
        (condominium_id, apartment_id, external_id, movement_date, document, concept, debit, credit, synced_at)
      values (
        p_condominium, v_apt, v_ext, tribuia.accounting_date(v_row ->> 'date'),
        left(nullif(btrim(coalesce(v_row ->> 'document', '')), ''), 60),
        left(coalesce(nullif(btrim(coalesce(v_row ->> 'concept', '')), ''), 'Movimiento'), 200),
        tribuia.accounting_number(v_row ->> 'debit'),
        tribuia.accounting_number(v_row ->> 'credit'),
        now()
      )
      on conflict (condominium_id, external_id) do update set
        apartment_id = excluded.apartment_id, movement_date = excluded.movement_date,
        document = excluded.document, concept = excluded.concept,
        debit = excluded.debit, credit = excluded.credit, synced_at = now();
      v_imported := v_imported + 1;
    end loop;

  elsif p_kind = 'FINANCIAL_STATEMENTS' then
    -- Filas: { period: "2026-09", kind: BALANCE|RESULTS, code, name, amount, level? }
    for v_period, v_kind in
      select distinct
             date_trunc('month', tribuia.accounting_date(r ->> 'period'))::date,
             case upper(coalesce(r ->> 'kind', ''))
               when 'RESULTADOS' then 'RESULTS' when 'RESULTS' then 'RESULTS'
               else 'BALANCE' end
        from jsonb_array_elements(p_rows) r
       where tribuia.accounting_date(r ->> 'period') is not null
    loop
      insert into tribuia.financial_statements (condominium_id, period, kind, lines, synced_at)
      select p_condominium, v_period, v_kind,
             coalesce(jsonb_agg(jsonb_build_object(
               'code', btrim(coalesce(r ->> 'code', '')),
               'name', btrim(coalesce(r ->> 'name', '')),
               'amount', tribuia.accounting_number(r ->> 'amount'),
               'level', coalesce(nullif(r ->> 'level', '')::integer, length(btrim(coalesce(r ->> 'code', ''))))
             ) order by r ->> 'code'), '[]'::jsonb),
             now()
        from jsonb_array_elements(p_rows) r
       where date_trunc('month', tribuia.accounting_date(r ->> 'period'))::date = v_period
         and case upper(coalesce(r ->> 'kind', ''))
               when 'RESULTADOS' then 'RESULTS' when 'RESULTS' then 'RESULTS'
               else 'BALANCE' end = v_kind
      on conflict (condominium_id, period, kind) do update set
        lines = excluded.lines, synced_at = now();
      v_imported := v_imported + 1;
    end loop;
    v_skipped := (select count(*) from jsonb_array_elements(p_rows) r
                   where tribuia.accounting_date(r ->> 'period') is null);

  elsif p_kind = 'BUDGET' then
    for v_row in select * from jsonb_array_elements(p_rows) loop
      if nullif(btrim(coalesce(v_row ->> 'code', '')), '') is null
         or coalesce(nullif(v_row ->> 'year', ''), '') !~ '^\d{4}$' then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      insert into tribuia.budget_lines (condominium_id, year, code, name, kind, budget, executed, synced_at)
      values (
        p_condominium, (v_row ->> 'year')::integer, btrim(v_row ->> 'code'),
        left(coalesce(nullif(btrim(coalesce(v_row ->> 'name', '')), ''), btrim(v_row ->> 'code')), 120),
        case when upper(coalesce(v_row ->> 'kind', '')) in ('INCOME', 'INGRESO', 'INGRESOS') then 'INCOME' else 'EXPENSE' end,
        tribuia.accounting_number(v_row ->> 'budget'),
        tribuia.accounting_number(v_row ->> 'executed'),
        now()
      )
      on conflict (condominium_id, year, code) do update set
        name = excluded.name, kind = excluded.kind, budget = excluded.budget,
        executed = excluded.executed, synced_at = now();
      v_imported := v_imported + 1;
    end loop;
  end if;

  v_status := case
    when v_imported = 0 and jsonb_array_length(p_rows) > 0 then 'ERROR'
    when v_skipped > 0 then 'PARTIAL'
    else 'OK'
  end;
  v_result := jsonb_build_object(
    'imported', v_imported,
    'skipped', v_skipped,
    'unmatched', to_jsonb((select array_agg(distinct u) from unnest(v_unmatched) u))
  );

  insert into tribuia.accounting_sync_runs (condominium_id, integration_id, source, kind, status, stats)
  values (p_condominium, p_integration, p_source, p_kind, v_status, v_result);

  if p_integration is not null then
    update tribuia.accounting_integrations
       set last_sync_at = now(),
           status = case when v_status = 'ERROR' then 'ERROR' else 'CONNECTED' end,
           last_error = case when v_status = 'ERROR' then 'No se pudo importar ninguna fila' else null end
     where id = p_integration and condominium_id = p_condominium;
  end if;

  return v_result;
end;
$$;

revoke all on function tribuia.match_accounting_unit(uuid, text) from public, anon;
revoke all on function tribuia.import_accounting_data(uuid, text, jsonb, text, uuid, date) from public, anon;
grant execute on function tribuia.normalize_unit_code(text) to authenticated, service_role;
grant execute on function tribuia.accounting_number(text) to authenticated, service_role;
grant execute on function tribuia.accounting_date(text) to authenticated, service_role;
grant execute on function tribuia.match_accounting_unit(uuid, text) to authenticated, service_role;
grant execute on function tribuia.import_accounting_data(uuid, text, jsonb, text, uuid, date) to authenticated, service_role;

-- ============================================================================
-- C. MODULOS, REALTIME Y PRUEBA GRATIS
-- ============================================================================
alter table tribuia.role_modules drop constraint if exists role_modules_module_check;
alter table tribuia.role_modules add constraint role_modules_module_check check (module in (
  'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
  'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
  'marketplace', 'reservations', 'logbook', 'staff', 'surveys', 'alarms', 'accounting'
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
    'marketplace', 'reservations', 'logbook', 'staff', 'surveys', 'alarms', 'accounting'
  ]::text[];
$$;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['alarm_events', 'unit_account_statements',
                           'unit_account_movements', 'financial_statements', 'budget_lines',
                           'portfolio_snapshots', 'accounting_sync_runs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'tribuia' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table tribuia.%I', t);
    end if;
  end loop;
end
$$;

-- Bloqueo de la prueba gratis vencida tambien en las tablas nuevas
-- (misma politica restrictiva de 20261020000000_prueba_gratis).
do $$
declare
  t text;
begin
  if to_regprocedure('tribuia.expired_condominium_ids()') is null then
    return;
  end if;
  foreach t in array array['alarm_devices', 'alarm_events', 'accounting_integrations',
                           'accounting_sync_runs', 'accounting_unit_links', 'unit_account_statements',
                           'unit_account_movements', 'financial_statements', 'budget_lines',
                           'portfolio_snapshots']
  loop
    execute format('drop policy if exists %1$s_trial_access on tribuia.%1$I', t);
    execute format(
      'create policy %1$s_trial_access on tribuia.%1$I as restrictive for all to authenticated
         using (condominium_id is null
                or condominium_id not in (select tribuia.expired_condominium_ids())
                or (select tribuia.is_super_admin()))
         with check (condominium_id is null
                or condominium_id not in (select tribuia.expired_condominium_ids())
                or (select tribuia.is_super_admin()))', t);
  end loop;
end
$$;

notify pgrst, 'reload schema';
