-- ============================================================================
-- EdiFeasy :: Gestion de la inmobiliaria (mandatos, liquidaciones, contratos)
-- ----------------------------------------------------------------------------
-- A. Mandatos de administracion con el propietario: comision, IVA, retencion
--    y cuenta donde se le gira.
-- B. Contratos: uso (vivienda/comercial), duracion, prorroga, preaviso, regla
--    de incremento, poliza, intereses de mora. En vivienda no se permite
--    deposito (Ley 820 de 2003, art. 16) en contratos nuevos.
-- C. Codeudores por contrato.
-- D. Incremento anual del canon (tope IPC en vivienda) con historial.
-- E. Cobros adicionales (servicios, intereses de mora, otros).
-- F. Gastos de la propiedad (mantenimiento) que el propietario aprueba.
-- G. Liquidaciones mensuales al propietario con sus lineas.
-- H. Firma electronica de contratos desde la web, con evidencia (hash del
--    texto, fecha, IP, navegador y trazo de la firma).
--
-- No borra ni cambia datos existentes: solo agrega columnas, tablas y RPC.
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- A. MANDATOS DE ADMINISTRACION
-- ============================================================================
create table if not exists tribuia.management_agreements (
  id                  uuid primary key default gen_random_uuid(),
  condominium_id      uuid not null references tribuia.condominiums (id) on delete cascade,
  property_id         uuid not null references tribuia.agency_properties (id) on delete cascade,
  owner_profile_id    uuid references tribuia.profiles (id) on delete set null,
  owner_name          text not null,
  owner_document_type text not null default 'CC',
  owner_document      text,
  owner_email         text,
  owner_phone         text,
  commission_pct      numeric(5, 2) not null default 10,
  charges_vat         boolean not null default true,
  vat_pct             numeric(5, 2) not null default 19,
  withholding_pct     numeric(5, 2) not null default 0,
  bank_name           text,
  account_type        text,
  account_number      text,
  account_holder      text,
  start_date          date not null default current_date,
  end_date            date,
  status              text not null default 'ACTIVE',
  notes               text,
  created_by          uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint management_agreements_status_check check (status in ('ACTIVE', 'ENDED')),
  constraint management_agreements_pct_check check (
    commission_pct between 0 and 30 and vat_pct between 0 and 30 and withholding_pct between 0 and 20
  ),
  constraint management_agreements_doc_type_check check (owner_document_type in ('CC', 'CE', 'NIT', 'PASAPORTE')),
  constraint management_agreements_account_check check (account_type is null or account_type in ('AHORROS', 'CORRIENTE')),
  constraint management_agreements_dates_check check (end_date is null or end_date >= start_date),
  constraint management_agreements_name_check check (length(btrim(owner_name)) between 3 and 140)
);

create unique index if not exists idx_management_agreements_active
  on tribuia.management_agreements (property_id) where status = 'ACTIVE';
create index if not exists idx_management_agreements_condominium on tribuia.management_agreements (condominium_id, status);
create index if not exists idx_management_agreements_owner on tribuia.management_agreements (owner_profile_id);
create index if not exists idx_management_agreements_created_by on tribuia.management_agreements (created_by);

create or replace function tribuia.tg_management_agreements_before()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not exists (select 1 from tribuia.agency_properties p where p.id = new.property_id and p.condominium_id = new.condominium_id) then
    raise exception 'La propiedad no pertenece a esta inmobiliaria' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.condominium_id is distinct from old.condominium_id then
    raise exception 'No se puede mover un mandato a otro espacio' using errcode = '42501';
  end if;
  if new.owner_profile_id is not null and not tribuia.has_role(new.condominium_id, array['OWNER'], new.owner_profile_id) then
    raise exception 'El propietario debe estar registrado en la inmobiliaria con rol Propietario' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_management_agreements_before on tribuia.management_agreements;
create trigger trg_management_agreements_before before insert or update on tribuia.management_agreements
  for each row execute function tribuia.tg_management_agreements_before();
drop trigger if exists trg_management_agreements_updated_at on tribuia.management_agreements;
create trigger trg_management_agreements_updated_at before update on tribuia.management_agreements
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_audit_management_agreements on tribuia.management_agreements;
create trigger trg_audit_management_agreements after insert or update or delete on tribuia.management_agreements
  for each row execute function tribuia.fn_audit();

-- ============================================================================
-- B. CAMPOS NUEVOS DEL CONTRATO
-- ============================================================================
alter table tribuia.property_leases add column if not exists lease_use text not null default 'VIVIENDA';
alter table tribuia.property_leases add column if not exists term_months integer not null default 12;
alter table tribuia.property_leases add column if not exists auto_renew boolean not null default true;
alter table tribuia.property_leases add column if not exists notice_months integer not null default 3;
alter table tribuia.property_leases add column if not exists notice_given_at date;
alter table tribuia.property_leases add column if not exists notice_by text;
alter table tribuia.property_leases add column if not exists increase_rule text not null default 'IPC';
alter table tribuia.property_leases add column if not exists increase_points numeric(5, 2) not null default 0;
alter table tribuia.property_leases add column if not exists last_increase_at date;
alter table tribuia.property_leases add column if not exists late_interest_pct numeric(6, 3);
alter table tribuia.property_leases add column if not exists insurer text;
alter table tribuia.property_leases add column if not exists policy_number text;
alter table tribuia.property_leases add column if not exists policy_expires_at date;
-- Firma electronica (seccion H).
alter table tribuia.property_leases add column if not exists contract_status text not null default 'NONE';
alter table tribuia.property_leases add column if not exists contract_text text;
alter table tribuia.property_leases add column if not exists contract_hash text;
alter table tribuia.property_leases add column if not exists contract_sent_at timestamptz;
alter table tribuia.property_leases add column if not exists contract_signed_at timestamptz;

alter table tribuia.property_leases drop constraint if exists property_leases_terms_check;
alter table tribuia.property_leases add constraint property_leases_terms_check check (
  lease_use in ('VIVIENDA', 'COMERCIAL')
  and term_months between 1 and 120
  and notice_months between 1 and 12
  and (notice_by is null or notice_by in ('ARRENDADOR', 'ARRENDATARIO'))
  and increase_rule in ('IPC', 'IPC_PLUS', 'FIXED')
  -- En vivienda el incremento es por IPC (Ley 820, art. 20); lo pactado solo en comercial.
  and (lease_use = 'COMERCIAL' or increase_rule = 'IPC')
  and increase_points between 0 and 50
  and (late_interest_pct is null or late_interest_pct between 0 and 5)
  and contract_status in ('NONE', 'SENT', 'SIGNED')
  and coalesce(char_length(contract_text), 0) <= 100000
);

-- Ley 820, art. 16: sin deposito en vivienda urbana. Se exige al crear el
-- contrato o al cambiar el deposito o el uso; los contratos ya guardados con
-- deposito se pueden seguir editando (por ejemplo, para terminarlos).
alter table tribuia.property_leases drop constraint if exists property_leases_no_deposit_check;

create or replace function tribuia.tg_property_leases_deposit()
returns trigger
language plpgsql
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.lease_use = 'VIVIENDA' and coalesce(new.deposit, 0) > 0
     and (tg_op = 'INSERT' or new.deposit is distinct from old.deposit or new.lease_use is distinct from old.lease_use) then
    raise exception 'En vivienda no se puede pedir deposito (Ley 820, art. 16). Usa poliza o codeudor' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_property_leases_deposit on tribuia.property_leases;
create trigger trg_property_leases_deposit before insert or update on tribuia.property_leases
  for each row execute function tribuia.tg_property_leases_deposit();

-- ============================================================================
-- C. CODEUDORES
-- ============================================================================
create table if not exists tribuia.lease_guarantors (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  lease_id       uuid not null references tribuia.property_leases (id) on delete cascade,
  name           text not null,
  document       text,
  phone          text,
  email          text,
  created_at     timestamptz not null default now(),
  constraint lease_guarantors_name_check check (length(btrim(name)) between 3 and 140)
);
create index if not exists idx_lease_guarantors_lease on tribuia.lease_guarantors (lease_id);
create index if not exists idx_lease_guarantors_condominium on tribuia.lease_guarantors (condominium_id);

create or replace function tribuia.tg_lease_child_before()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not exists (select 1 from tribuia.property_leases l where l.id = new.lease_id and l.condominium_id = new.condominium_id) then
    raise exception 'El contrato no pertenece a esta inmobiliaria' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lease_guarantors_before on tribuia.lease_guarantors;
create trigger trg_lease_guarantors_before before insert or update on tribuia.lease_guarantors
  for each row execute function tribuia.tg_lease_child_before();

-- ============================================================================
-- D. INCREMENTO ANUAL DEL CANON
-- ============================================================================
create table if not exists tribuia.lease_rent_adjustments (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  lease_id       uuid not null references tribuia.property_leases (id) on delete cascade,
  effective_date date not null,
  previous_rent  numeric(14, 2) not null,
  new_rent       numeric(14, 2) not null,
  index_type     text not null,
  index_value    numeric(6, 3) not null,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint lease_rent_adjustments_type_check check (index_type in ('IPC', 'IPC_PLUS', 'FIXED')),
  constraint lease_rent_adjustments_amount_check check (previous_rent > 0 and new_rent > 0)
);
create index if not exists idx_lease_rent_adjustments_lease on tribuia.lease_rent_adjustments (lease_id, effective_date desc);
create index if not exists idx_lease_rent_adjustments_condominium on tribuia.lease_rent_adjustments (condominium_id);
create index if not exists idx_lease_rent_adjustments_created_by on tribuia.lease_rent_adjustments (created_by);

-- p_index_pct: IPC del ano anterior (DANE) o el % pactado si la regla es FIXED.
create or replace function tribuia.apply_rent_increase(p_lease uuid, p_index_pct numeric, p_effective date)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_lease   tribuia.property_leases%rowtype;
  v_since   date;
  v_pct     numeric;
  v_new     numeric;
  v_updated integer;
begin
  select * into v_lease from tribuia.property_leases where id = p_lease for update;
  if not found or not tribuia.is_condominium_admin(v_lease.condominium_id) then
    raise exception 'Solo la administracion de la inmobiliaria ajusta el canon' using errcode = '42501';
  end if;
  if v_lease.status <> 'ACTIVE' then
    raise exception 'El contrato no esta activo' using errcode = 'P0001';
  end if;
  if p_index_pct is null or p_index_pct < 0 or p_index_pct > 30 then
    raise exception 'El porcentaje debe estar entre 0 y 30' using errcode = '22023';
  end if;
  v_since := coalesce(v_lease.last_increase_at, v_lease.start_date);
  if p_effective is null or p_effective < (v_since + interval '12 months')::date then
    raise exception 'El canon solo se puede subir cada 12 meses (desde el %)',
      to_char((v_since + interval '12 months')::date, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;

  v_pct := case v_lease.increase_rule
             when 'IPC_PLUS' then p_index_pct + v_lease.increase_points
             else p_index_pct
           end;
  -- Vivienda: tope del 100 % del IPC del ano anterior (Ley 820, art. 20).
  if v_lease.lease_use = 'VIVIENDA' then
    v_pct := least(v_pct, p_index_pct);
  end if;
  v_new := round(v_lease.monthly_rent * (1 + v_pct / 100));

  insert into tribuia.lease_rent_adjustments
    (condominium_id, lease_id, effective_date, previous_rent, new_rent, index_type, index_value)
  values (v_lease.condominium_id, p_lease, p_effective, v_lease.monthly_rent, v_new, v_lease.increase_rule, p_index_pct);

  update tribuia.property_leases
     set monthly_rent = v_new, last_increase_at = p_effective
   where id = p_lease;

  -- Cobros de canon pendientes desde ese mes quedan con el valor nuevo.
  update tribuia.lease_charges
     set amount = v_new
   where lease_id = p_lease and concept = 'RENT' and status = 'PENDING'
     and period >= date_trunc('month', p_effective)::date;
  get diagnostics v_updated = row_count;

  if v_lease.tenant_profile_id is not null then
    insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    values (v_lease.condominium_id, v_lease.tenant_profile_id,
            'Tu canon se ajusta desde el ' || to_char(p_effective, 'DD/MM/YYYY'),
            'Nuevo canon: $' || to_char(v_new, 'FM999G999G999G999') || ' (' || v_pct || ' %).',
            'SYSTEM'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level,
            'property_leases', p_lease, '/agency/my-lease');
  end if;

  return jsonb_build_object('previous_rent', v_lease.monthly_rent, 'new_rent', v_new,
                            'pct', v_pct, 'updated_charges', v_updated);
end;
$$;

-- ============================================================================
-- E. COBROS ADICIONALES (servicios, intereses de mora, otros)
-- ============================================================================
alter table tribuia.lease_charges drop constraint if exists lease_charges_concept_check;
alter table tribuia.lease_charges add constraint lease_charges_concept_check
  check (concept in ('RENT', 'ADMIN_FEE', 'UTILITIES', 'LATE_FEE', 'OTHER'));

create or replace function tribuia.create_lease_charge(
  p_lease uuid,
  p_concept text,
  p_amount numeric,
  p_description text,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_lease tribuia.property_leases%rowtype;
  v_id    uuid;
begin
  select * into v_lease from tribuia.property_leases where id = p_lease;
  if not found or not tribuia.is_condominium_admin(v_lease.condominium_id) then
    raise exception 'Solo la administracion de la inmobiliaria crea cobros' using errcode = '42501';
  end if;
  if p_concept not in ('UTILITIES', 'LATE_FEE', 'OTHER') then
    raise exception 'Concepto no valido' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
    raise exception 'Escribe un valor valido' using errcode = '22023';
  end if;
  if p_due_date is null then
    raise exception 'Elige la fecha limite' using errcode = '22023';
  end if;

  insert into tribuia.lease_charges (condominium_id, lease_id, property_id, period, concept, description, amount, due_date)
  values (v_lease.condominium_id, p_lease, v_lease.property_id, date_trunc('month', p_due_date)::date, p_concept,
          nullif(btrim(coalesce(p_description, '')), ''), round(p_amount), p_due_date)
  returning id into v_id;

  if v_lease.tenant_profile_id is not null then
    insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    values (v_lease.condominium_id, v_lease.tenant_profile_id, 'Tienes un nuevo cobro',
            coalesce(nullif(btrim(coalesce(p_description, '')), ''), 'Revisalo en Mi arriendo.'),
            'SYSTEM'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level,
            'lease_charges', v_id, '/agency/my-lease');
  end if;
  return v_id;
end;
$$;

-- ============================================================================
-- F. GASTOS DE LA PROPIEDAD
-- ============================================================================
create table if not exists tribuia.property_expenses (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  property_id    uuid not null references tribuia.agency_properties (id) on delete cascade,
  description    text not null,
  amount         numeric(14, 2) not null,
  expense_date   date not null default current_date,
  receipt_url    text,
  approved_at    timestamptz,
  approved_by    uuid references tribuia.profiles (id) on delete set null,
  settlement_id  uuid,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint property_expenses_amount_check check (amount > 0),
  constraint property_expenses_description_check check (length(btrim(description)) between 3 and 300)
);
create index if not exists idx_property_expenses_property on tribuia.property_expenses (property_id, expense_date desc);
create index if not exists idx_property_expenses_condominium on tribuia.property_expenses (condominium_id);
create index if not exists idx_property_expenses_settlement on tribuia.property_expenses (settlement_id);
create index if not exists idx_property_expenses_created_by on tribuia.property_expenses (created_by);
create index if not exists idx_property_expenses_approved_by on tribuia.property_expenses (approved_by);

create or replace function tribuia.tg_property_expenses_before()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not exists (select 1 from tribuia.agency_properties p where p.id = new.property_id and p.condominium_id = new.condominium_id) then
    raise exception 'La propiedad no pertenece a esta inmobiliaria' using errcode = 'P0001';
  end if;
  -- Un gasto liquidado no cambia; solo se puede soltar o asignar su liquidacion.
  if tg_op = 'UPDATE' and old.settlement_id is not null
     and (new.description, new.amount, new.expense_date, new.property_id, new.approved_at)
         is distinct from (old.description, old.amount, old.expense_date, old.property_id, old.approved_at) then
    raise exception 'El gasto ya esta en una liquidacion' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_property_expenses_before on tribuia.property_expenses;
create trigger trg_property_expenses_before before insert or update on tribuia.property_expenses
  for each row execute function tribuia.tg_property_expenses_before();

-- El propietario (o la inmobiliaria con su autorizacion) aprueba el gasto.
create or replace function tribuia.approve_property_expense(p_expense uuid)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_expense tribuia.property_expenses%rowtype;
begin
  select * into v_expense from tribuia.property_expenses where id = p_expense;
  if not found or not (
    tribuia.is_condominium_admin(v_expense.condominium_id)
    or v_expense.property_id in (select tribuia.user_owned_property_ids())
  ) then
    raise exception 'No puedes aprobar este gasto' using errcode = '42501';
  end if;
  update tribuia.property_expenses
     set approved_at = now(), approved_by = auth.uid()
   where id = p_expense and approved_at is null;
  return p_expense;
end;
$$;

-- ============================================================================
-- G. LIQUIDACIONES AL PROPIETARIO
-- ============================================================================
create table if not exists tribuia.owner_settlements (
  id                 uuid primary key default gen_random_uuid(),
  condominium_id     uuid not null references tribuia.condominiums (id) on delete cascade,
  agreement_id       uuid not null references tribuia.management_agreements (id) on delete cascade,
  property_id        uuid not null references tribuia.agency_properties (id) on delete cascade,
  owner_profile_id   uuid references tribuia.profiles (id) on delete set null,
  owner_name         text not null,
  period             date not null,
  gross_collected    numeric(14, 2) not null default 0,
  commission         numeric(14, 2) not null default 0,
  vat                numeric(14, 2) not null default 0,
  withholding        numeric(14, 2) not null default 0,
  expenses           numeric(14, 2) not null default 0,
  net_payable        numeric(14, 2) not null default 0,
  commission_pct     numeric(5, 2) not null,
  vat_pct            numeric(5, 2) not null,
  withholding_pct    numeric(5, 2) not null,
  status             text not null default 'DRAFT',
  approved_at        timestamptz,
  paid_at            timestamptz,
  transfer_reference text,
  created_by         uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint owner_settlements_status_check check (status in ('DRAFT', 'APPROVED', 'PAID', 'VOID'))
);
create unique index if not exists idx_owner_settlements_period
  on tribuia.owner_settlements (agreement_id, period) where status <> 'VOID';
create index if not exists idx_owner_settlements_condominium on tribuia.owner_settlements (condominium_id, period desc);
create index if not exists idx_owner_settlements_owner on tribuia.owner_settlements (owner_profile_id);
create index if not exists idx_owner_settlements_property on tribuia.owner_settlements (property_id);
create index if not exists idx_owner_settlements_created_by on tribuia.owner_settlements (created_by);

drop trigger if exists trg_owner_settlements_updated_at on tribuia.owner_settlements;
create trigger trg_owner_settlements_updated_at before update on tribuia.owner_settlements
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_audit_owner_settlements on tribuia.owner_settlements;
create trigger trg_audit_owner_settlements after insert or update or delete on tribuia.owner_settlements
  for each row execute function tribuia.fn_audit();

create table if not exists tribuia.owner_settlement_lines (
  id              uuid primary key default gen_random_uuid(),
  condominium_id  uuid not null references tribuia.condominiums (id) on delete cascade,
  settlement_id   uuid not null references tribuia.owner_settlements (id) on delete cascade,
  kind            text not null,
  description     text not null,
  amount          numeric(14, 2) not null,
  lease_charge_id uuid references tribuia.lease_charges (id) on delete set null,
  expense_id      uuid references tribuia.property_expenses (id) on delete set null,
  constraint owner_settlement_lines_kind_check check (kind in ('RENT', 'COMMISSION', 'VAT', 'WITHHOLDING', 'EXPENSE'))
);
create index if not exists idx_owner_settlement_lines_settlement on tribuia.owner_settlement_lines (settlement_id);
create index if not exists idx_owner_settlement_lines_condominium on tribuia.owner_settlement_lines (condominium_id);
create index if not exists idx_owner_settlement_lines_charge on tribuia.owner_settlement_lines (lease_charge_id);
create index if not exists idx_owner_settlement_lines_expense on tribuia.owner_settlement_lines (expense_id);

-- Un cobro de canon o un gasto entra a una sola liquidacion.
alter table tribuia.lease_charges add column if not exists settlement_id uuid
  references tribuia.owner_settlements (id) on delete set null;
create index if not exists idx_lease_charges_settlement on tribuia.lease_charges (settlement_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'property_expenses_settlement_fkey') then
    alter table tribuia.property_expenses add constraint property_expenses_settlement_fkey
      foreign key (settlement_id) references tribuia.owner_settlements (id) on delete set null;
  end if;
end
$$;

-- Libera los cobros y gastos de una liquidacion (al anularla o regenerarla).
create or replace function tribuia.release_owner_settlement(p_settlement uuid)
returns void
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  update tribuia.lease_charges set settlement_id = null where settlement_id = p_settlement;
  update tribuia.property_expenses set settlement_id = null where settlement_id = p_settlement;
end;
$$;

-- Liquidacion del mes de un mandato: canon cobrado y pagado (hasta el fin del
-- mes y aun no liquidado) - comision - IVA - retencion - gastos aprobados.
-- La cuota de administracion del conjunto no entra: es un pago a terceros.
create or replace function tribuia.generate_owner_settlement(p_agreement uuid, p_period date)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_ag        tribuia.management_agreements%rowtype;
  v_period    date := date_trunc('month', p_period)::date;
  v_end       date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_existing  tribuia.owner_settlements%rowtype;
  v_id        uuid;
  v_gross     numeric := 0;
  v_expenses  numeric := 0;
  v_comm      numeric;
  v_vat       numeric;
  v_with      numeric;
begin
  select * into v_ag from tribuia.management_agreements where id = p_agreement;
  if not found or not tribuia.is_condominium_admin(v_ag.condominium_id) then
    raise exception 'Solo la administracion de la inmobiliaria liquida' using errcode = '42501';
  end if;
  if p_period is null then
    raise exception 'Elige el mes' using errcode = '22023';
  end if;

  select * into v_existing from tribuia.owner_settlements
   where agreement_id = p_agreement and period = v_period and status <> 'VOID';
  if found then
    if v_existing.status <> 'DRAFT' then
      raise exception 'La liquidacion de este mes ya fue aprobada' using errcode = 'P0001';
    end if;
    perform tribuia.release_owner_settlement(v_existing.id);
    delete from tribuia.owner_settlements where id = v_existing.id;
  end if;

  select coalesce(sum(c.amount), 0) into v_gross
    from tribuia.lease_charges c
   where c.property_id = v_ag.property_id and c.concept = 'RENT' and c.status = 'PAID'
     and c.settlement_id is null and c.paid_at < (v_end + 1)::timestamptz;
  select coalesce(sum(e.amount), 0) into v_expenses
    from tribuia.property_expenses e
   where e.property_id = v_ag.property_id and e.approved_at is not null
     and e.settlement_id is null and e.expense_date <= v_end;

  if v_gross = 0 and v_expenses = 0 then
    raise exception 'No hay pagos ni gastos para liquidar en este mes' using errcode = 'P0001';
  end if;

  v_comm := round(v_gross * v_ag.commission_pct / 100);
  v_vat  := case when v_ag.charges_vat then round(v_comm * v_ag.vat_pct / 100) else 0 end;
  v_with := round(v_gross * v_ag.withholding_pct / 100);

  insert into tribuia.owner_settlements
    (condominium_id, agreement_id, property_id, owner_profile_id, owner_name, period,
     gross_collected, commission, vat, withholding, expenses, net_payable,
     commission_pct, vat_pct, withholding_pct)
  values
    (v_ag.condominium_id, v_ag.id, v_ag.property_id, v_ag.owner_profile_id, v_ag.owner_name, v_period,
     v_gross, v_comm, v_vat, v_with, v_expenses, v_gross - v_comm - v_vat - v_with - v_expenses,
     v_ag.commission_pct, case when v_ag.charges_vat then v_ag.vat_pct else 0 end, v_ag.withholding_pct)
  returning id into v_id;

  insert into tribuia.owner_settlement_lines (condominium_id, settlement_id, kind, description, amount, lease_charge_id)
  select v_ag.condominium_id, v_id, 'RENT', coalesce(c.description, 'Canon ' || to_char(c.period, 'MM/YYYY')), c.amount, c.id
    from tribuia.lease_charges c
   where c.property_id = v_ag.property_id and c.concept = 'RENT' and c.status = 'PAID'
     and c.settlement_id is null and c.paid_at < (v_end + 1)::timestamptz;
  update tribuia.lease_charges c set settlement_id = v_id
   where c.property_id = v_ag.property_id and c.concept = 'RENT' and c.status = 'PAID'
     and c.settlement_id is null and c.paid_at < (v_end + 1)::timestamptz;

  if v_comm > 0 then
    insert into tribuia.owner_settlement_lines (condominium_id, settlement_id, kind, description, amount)
    values (v_ag.condominium_id, v_id, 'COMMISSION', 'Comision de administracion ' || v_ag.commission_pct || ' %', -v_comm);
  end if;
  if v_vat > 0 then
    insert into tribuia.owner_settlement_lines (condominium_id, settlement_id, kind, description, amount)
    values (v_ag.condominium_id, v_id, 'VAT', 'IVA ' || v_ag.vat_pct || ' % sobre la comision', -v_vat);
  end if;
  if v_with > 0 then
    insert into tribuia.owner_settlement_lines (condominium_id, settlement_id, kind, description, amount)
    values (v_ag.condominium_id, v_id, 'WITHHOLDING', 'Retencion ' || v_ag.withholding_pct || ' %', -v_with);
  end if;

  insert into tribuia.owner_settlement_lines (condominium_id, settlement_id, kind, description, amount, expense_id)
  select v_ag.condominium_id, v_id, 'EXPENSE', e.description, -e.amount, e.id
    from tribuia.property_expenses e
   where e.property_id = v_ag.property_id and e.approved_at is not null
     and e.settlement_id is null and e.expense_date <= v_end;
  update tribuia.property_expenses e set settlement_id = v_id
   where e.property_id = v_ag.property_id and e.approved_at is not null
     and e.settlement_id is null and e.expense_date <= v_end;

  return v_id;
end;
$$;

-- Todas las liquidaciones del mes; devuelve cuantas quedaron listas.
create or replace function tribuia.generate_owner_settlements(p_condominium uuid, p_period date)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_ag    record;
  v_count integer := 0;
begin
  if not tribuia.is_condominium_admin(p_condominium) then
    raise exception 'Solo la administracion de la inmobiliaria liquida' using errcode = '42501';
  end if;
  for v_ag in
    select id from tribuia.management_agreements
     where condominium_id = p_condominium and status = 'ACTIVE'
  loop
    begin
      perform tribuia.generate_owner_settlement(v_ag.id, p_period);
      v_count := v_count + 1;
    exception when sqlstate 'P0001' then
      -- Sin pagos en el mes o ya aprobada: se sigue con la siguiente.
      null;
    end;
  end loop;
  return v_count;
end;
$$;

-- DRAFT -> APPROVED -> PAID; DRAFT o APPROVED -> VOID (libera cobros y gastos).
create or replace function tribuia.set_owner_settlement_status(p_settlement uuid, p_status text, p_reference text default null)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.owner_settlements%rowtype;
begin
  select * into v_row from tribuia.owner_settlements where id = p_settlement for update;
  if not found or not tribuia.is_condominium_admin(v_row.condominium_id) then
    raise exception 'Solo la administracion de la inmobiliaria cambia liquidaciones' using errcode = '42501';
  end if;
  if not (
    (v_row.status = 'DRAFT' and p_status in ('APPROVED', 'VOID'))
    or (v_row.status = 'APPROVED' and p_status in ('PAID', 'VOID'))
  ) then
    raise exception 'Cambio de estado no permitido' using errcode = 'P0001';
  end if;

  if p_status = 'VOID' then
    perform tribuia.release_owner_settlement(p_settlement);
  end if;
  update tribuia.owner_settlements
     set status = p_status,
         approved_at = case when p_status = 'APPROVED' then now() else approved_at end,
         paid_at = case when p_status = 'PAID' then now() else paid_at end,
         transfer_reference = case when p_status = 'PAID' then nullif(btrim(coalesce(p_reference, '')), '') else transfer_reference end
   where id = p_settlement;

  if p_status in ('APPROVED', 'PAID') and v_row.owner_profile_id is not null then
    insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    values (v_row.condominium_id, v_row.owner_profile_id,
            case when p_status = 'PAID' then 'Te giramos tu liquidacion de ' || to_char(v_row.period, 'MM/YYYY')
                 else 'Tu liquidacion de ' || to_char(v_row.period, 'MM/YYYY') || ' esta lista' end,
            'Neto: $' || to_char(v_row.net_payable, 'FM999G999G999G999'),
            'SYSTEM'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level,
            'owner_settlements', p_settlement, '/agency/statements');
  end if;
  return p_settlement;
end;
$$;

-- ============================================================================
-- H. FIRMA ELECTRONICA DE CONTRATOS
-- ----------------------------------------------------------------------------
-- La inmobiliaria congela el texto (hash SHA-256) y crea un firmante por parte.
-- Cada firmante recibe un enlace con un token (en la base solo queda su hash).
-- Al firmar se guarda: nombre y documento escritos, trazo de la firma, fecha,
-- IP, navegador y el hash del texto que vio. Cuando todos firman, el contrato
-- queda SIGNED y ya no se puede cambiar el texto.
-- ============================================================================
create table if not exists tribuia.lease_signers (
  id               uuid primary key default gen_random_uuid(),
  condominium_id   uuid not null references tribuia.condominiums (id) on delete cascade,
  lease_id         uuid not null references tribuia.property_leases (id) on delete cascade,
  role             text not null,
  name             text not null,
  document         text,
  email            text,
  phone            text,
  profile_id       uuid references tribuia.profiles (id) on delete set null,
  sort_order       integer not null default 0,
  token_hash       text,
  token_hint       text,
  signed_at        timestamptz,
  signed_name      text,
  signed_document  text,
  signature_image  text,
  content_hash     text,
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now(),
  constraint lease_signers_role_check check (role in ('AGENCY', 'TENANT', 'OWNER', 'GUARANTOR')),
  constraint lease_signers_name_check check (length(btrim(name)) between 3 and 140),
  constraint lease_signers_signature_check check (
    signature_image is null or (signature_image like 'data:image/png;base64,%' and char_length(signature_image) <= 400000)
  )
);
create unique index if not exists idx_lease_signers_token on tribuia.lease_signers (token_hash) where token_hash is not null;
create index if not exists idx_lease_signers_lease on tribuia.lease_signers (lease_id, sort_order);
create index if not exists idx_lease_signers_condominium on tribuia.lease_signers (condominium_id);
create index if not exists idx_lease_signers_profile on tribuia.lease_signers (profile_id);

create or replace function tribuia.signing_token_hash(p_token text)
returns text
language sql
immutable
set search_path = tribuia, public, pg_temp
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

create or replace function tribuia.new_signing_token()
returns text
language sql
volatile
set search_path = tribuia, public, pg_temp
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Congela el texto y crea los firmantes. p_signers: [{role, name, document,
-- email, phone, profile_id}]. Si ya habia un envio sin terminar, lo reemplaza.
create or replace function tribuia.send_lease_for_signature(p_lease uuid, p_text text, p_signers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_lease tribuia.property_leases%rowtype;
  v_item  jsonb;
  v_order integer := 0;
begin
  select * into v_lease from tribuia.property_leases where id = p_lease for update;
  if not found or not tribuia.is_condominium_admin(v_lease.condominium_id) then
    raise exception 'Solo la administracion de la inmobiliaria envia contratos a firma' using errcode = '42501';
  end if;
  if v_lease.contract_status = 'SIGNED' then
    raise exception 'El contrato ya esta firmado por todas las partes' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_text, ''))) < 200 then
    raise exception 'El texto del contrato esta incompleto' using errcode = '22023';
  end if;
  if jsonb_typeof(p_signers) <> 'array' or jsonb_array_length(p_signers) = 0 then
    raise exception 'Agrega al menos un firmante' using errcode = '22023';
  end if;
  if jsonb_array_length(p_signers) > 8 then
    raise exception 'Maximo 8 firmantes' using errcode = '22023';
  end if;

  delete from tribuia.lease_signers where lease_id = p_lease;

  update tribuia.property_leases
     set contract_text = p_text,
         contract_hash = encode(sha256(convert_to(p_text, 'UTF8')), 'hex'),
         contract_status = 'SENT',
         contract_sent_at = now(),
         contract_signed_at = null
   where id = p_lease;

  for v_item in select * from jsonb_array_elements(p_signers)
  loop
    insert into tribuia.lease_signers (condominium_id, lease_id, role, name, document, email, phone, profile_id, sort_order)
    values (v_lease.condominium_id, p_lease, v_item ->> 'role', btrim(coalesce(v_item ->> 'name', '')),
            nullif(btrim(coalesce(v_item ->> 'document', '')), ''),
            nullif(btrim(coalesce(v_item ->> 'email', '')), ''),
            nullif(btrim(coalesce(v_item ->> 'phone', '')), ''),
            nullif(v_item ->> 'profile_id', '')::uuid, v_order);
    v_order := v_order + 1;
  end loop;

  -- Aviso en la app a los firmantes con cuenta.
  insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
  select v_lease.condominium_id, s.profile_id, 'Tienes un contrato para firmar',
         'Revisalo y firmalo desde la app.', 'SYSTEM'::tribuia.notification_type, 'HIGH'::tribuia.priority_level,
         'property_leases', p_lease,
         case when s.role = 'TENANT' then '/agency/my-lease' else '/agency/my-properties' end
    from tribuia.lease_signers s
   where s.lease_id = p_lease and s.profile_id is not null;

  return jsonb_build_object('hash', (select contract_hash from tribuia.property_leases where id = p_lease));
end;
$$;

-- Cancela un envio a firma que no ha terminado (para corregir el texto).
create or replace function tribuia.cancel_lease_signature(p_lease uuid)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_lease tribuia.property_leases%rowtype;
begin
  select * into v_lease from tribuia.property_leases where id = p_lease for update;
  if not found or not tribuia.is_condominium_admin(v_lease.condominium_id) then
    raise exception 'Solo la administracion de la inmobiliaria cancela firmas' using errcode = '42501';
  end if;
  if v_lease.contract_status = 'SIGNED' then
    raise exception 'Un contrato firmado por todos no se puede cancelar' using errcode = 'P0001';
  end if;
  delete from tribuia.lease_signers where lease_id = p_lease;
  update tribuia.property_leases set contract_status = 'NONE', contract_sent_at = null where id = p_lease;
  return p_lease;
end;
$$;

-- Enlace de firma: la inmobiliaria lo pide para un firmante; el arrendatario o
-- propietario con cuenta lo pide para si mismo. Cada llamada invalida el anterior.
create or replace function tribuia.lease_signing_link(p_signer uuid)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_signer tribuia.lease_signers%rowtype;
  v_status text;
  v_token  text := tribuia.new_signing_token();
begin
  select * into v_signer from tribuia.lease_signers where id = p_signer;
  if not found or not (
    tribuia.is_condominium_admin(v_signer.condominium_id)
    or (v_signer.profile_id is not null and v_signer.profile_id = auth.uid())
  ) then
    raise exception 'No puedes pedir este enlace de firma' using errcode = '42501';
  end if;
  select contract_status into v_status from tribuia.property_leases where id = v_signer.lease_id;
  if v_status <> 'SENT' or v_signer.signed_at is not null then
    raise exception 'Este firmante ya no tiene firmas pendientes' using errcode = 'P0001';
  end if;
  update tribuia.lease_signers
     set token_hash = tribuia.signing_token_hash(v_token), token_hint = right(v_token, 4)
   where id = p_signer;
  return v_token;
end;
$$;

-- Lo que ve quien abre el enlace (publico: el token es la credencial).
create or replace function tribuia.lease_contract_for_signing(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_signer tribuia.lease_signers%rowtype;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;
  select * into v_signer from tribuia.lease_signers where token_hash = tribuia.signing_token_hash(p_token);
  if not found then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'agency', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'primary_color', c.settings ->> 'primaryColor'),
      'contract', jsonb_build_object('text', l.contract_text, 'hash', l.contract_hash,
                                     'status', l.contract_status, 'sent_at', l.contract_sent_at,
                                     'property', p.title),
      'signer', jsonb_build_object('role', v_signer.role, 'name', v_signer.name, 'document', v_signer.document,
                                   'signed_at', v_signer.signed_at),
      'signers', (select jsonb_agg(jsonb_build_object('role', s.role, 'name', s.name, 'signed', s.signed_at is not null)
                                   order by s.sort_order)
                    from tribuia.lease_signers s where s.lease_id = l.id)
    )
    from tribuia.property_leases l
    join tribuia.condominiums c on c.id = l.condominium_id
    join tribuia.agency_properties p on p.id = l.property_id
    where l.id = v_signer.lease_id
  );
end;
$$;

create or replace function tribuia.sign_lease_contract(
  p_token text,
  p_name text,
  p_document text,
  p_signature text,
  p_hash text,
  p_accept boolean,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_signer  tribuia.lease_signers%rowtype;
  v_lease   tribuia.property_leases%rowtype;
  v_ip      text;
  v_pending integer;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Enlace de firma no valido' using errcode = '42501';
  end if;
  select * into v_signer from tribuia.lease_signers
   where token_hash = tribuia.signing_token_hash(p_token) for update;
  if not found then
    raise exception 'Enlace de firma no valido o vencido' using errcode = '42501';
  end if;
  select * into v_lease from tribuia.property_leases where id = v_signer.lease_id for update;
  if v_lease.contract_status <> 'SENT' then
    raise exception 'Este contrato ya no esta abierto a firma' using errcode = 'P0001';
  end if;
  if v_signer.signed_at is not null then
    raise exception 'Ya firmaste este contrato' using errcode = 'P0001';
  end if;
  if coalesce(p_accept, false) is not true then
    raise exception 'Debes aceptar firmar electronicamente' using errcode = '22023';
  end if;
  if p_hash is distinct from v_lease.contract_hash then
    raise exception 'El contrato cambio mientras lo leias. Vuelve a abrir el enlace' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 3 then
    raise exception 'Escribe tu nombre completo' using errcode = '22023';
  end if;
  if length(regexp_replace(coalesce(p_document, ''), '\D', '', 'g')) < 5 then
    raise exception 'Escribe tu numero de documento' using errcode = '22023';
  end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' or char_length(p_signature) > 400000 then
    raise exception 'Dibuja tu firma' using errcode = '22023';
  end if;

  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := null;
  end;

  update tribuia.lease_signers
     set signed_at = now(),
         signed_name = btrim(p_name),
         signed_document = btrim(p_document),
         signature_image = p_signature,
         content_hash = v_lease.contract_hash,
         ip = nullif(btrim(v_ip), ''),
         user_agent = left(p_user_agent, 300),
         token_hash = null
   where id = v_signer.id;

  select count(*) into v_pending from tribuia.lease_signers where lease_id = v_lease.id and signed_at is null;
  if v_pending = 0 then
    update tribuia.property_leases
       set contract_status = 'SIGNED', contract_signed_at = now()
     where id = v_lease.id;
    insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select distinct v_lease.condominium_id, m.user_id, 'Contrato firmado por todas las partes',
           v_lease.tenant_name, 'SYSTEM'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level,
           'property_leases', v_lease.id, '/agency/leases'
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id
     where m.condominium_id = v_lease.condominium_id and m.status = 'ACTIVE' and r.code = 'ADMINISTRATOR';
  end if;

  return jsonb_build_object('signed', true, 'complete', v_pending = 0);
end;
$$;

-- ============================================================================
-- PERMISOS Y RLS
-- ============================================================================
revoke all on function tribuia.apply_rent_increase(uuid, numeric, date) from public, anon;
revoke all on function tribuia.create_lease_charge(uuid, text, numeric, text, date) from public, anon;
revoke all on function tribuia.approve_property_expense(uuid) from public, anon;
revoke all on function tribuia.release_owner_settlement(uuid) from public, anon, authenticated;
revoke all on function tribuia.generate_owner_settlement(uuid, date) from public, anon;
revoke all on function tribuia.generate_owner_settlements(uuid, date) from public, anon;
revoke all on function tribuia.set_owner_settlement_status(uuid, text, text) from public, anon;
revoke all on function tribuia.signing_token_hash(text) from public, anon, authenticated;
revoke all on function tribuia.new_signing_token() from public, anon, authenticated;
revoke all on function tribuia.send_lease_for_signature(uuid, text, jsonb) from public, anon;
revoke all on function tribuia.cancel_lease_signature(uuid) from public, anon;
revoke all on function tribuia.lease_signing_link(uuid) from public, anon;
revoke all on function tribuia.lease_contract_for_signing(text) from public;
revoke all on function tribuia.sign_lease_contract(text, text, text, text, text, boolean, text) from public;

grant execute on function tribuia.apply_rent_increase(uuid, numeric, date) to authenticated, service_role;
grant execute on function tribuia.create_lease_charge(uuid, text, numeric, text, date) to authenticated, service_role;
grant execute on function tribuia.approve_property_expense(uuid) to authenticated, service_role;
grant execute on function tribuia.release_owner_settlement(uuid) to service_role;
grant execute on function tribuia.generate_owner_settlement(uuid, date) to authenticated, service_role;
grant execute on function tribuia.generate_owner_settlements(uuid, date) to authenticated, service_role;
grant execute on function tribuia.set_owner_settlement_status(uuid, text, text) to authenticated, service_role;
grant execute on function tribuia.signing_token_hash(text) to service_role;
grant execute on function tribuia.new_signing_token() to service_role;
grant execute on function tribuia.send_lease_for_signature(uuid, text, jsonb) to authenticated, service_role;
grant execute on function tribuia.cancel_lease_signature(uuid) to authenticated, service_role;
grant execute on function tribuia.lease_signing_link(uuid) to authenticated, service_role;
grant execute on function tribuia.lease_contract_for_signing(text) to anon, authenticated, service_role;
grant execute on function tribuia.sign_lease_contract(text, text, text, text, text, boolean, text) to anon, authenticated, service_role;

alter table tribuia.management_agreements enable row level security;
alter table tribuia.lease_guarantors enable row level security;
alter table tribuia.lease_rent_adjustments enable row level security;
alter table tribuia.property_expenses enable row level security;
alter table tribuia.owner_settlements enable row level security;
alter table tribuia.owner_settlement_lines enable row level security;
alter table tribuia.lease_signers enable row level security;

-- Mandatos: la inmobiliaria administra; el propietario ve los suyos.
drop policy if exists management_agreements_select on tribuia.management_agreements;
create policy management_agreements_select on tribuia.management_agreements for select to authenticated
  using (tribuia.is_condominium_admin(condominium_id) or owner_profile_id = (select auth.uid()));
drop policy if exists management_agreements_write on tribuia.management_agreements;
create policy management_agreements_write on tribuia.management_agreements for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- Codeudores: la inmobiliaria; el arrendatario ve los de su contrato.
drop policy if exists lease_guarantors_select on tribuia.lease_guarantors;
create policy lease_guarantors_select on tribuia.lease_guarantors for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or lease_id in (select l.id from tribuia.property_leases l where l.tenant_profile_id = (select auth.uid()))
  );
drop policy if exists lease_guarantors_write on tribuia.lease_guarantors;
create policy lease_guarantors_write on tribuia.lease_guarantors for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id))
  with check (tribuia.is_condominium_admin(condominium_id));

-- Ajustes de canon: solo lectura (se escriben por RPC).
drop policy if exists lease_rent_adjustments_select on tribuia.lease_rent_adjustments;
create policy lease_rent_adjustments_select on tribuia.lease_rent_adjustments for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or lease_id in (select l.id from tribuia.property_leases l where l.tenant_profile_id = (select auth.uid()))
    or lease_id in (select l.id from tribuia.property_leases l where l.property_id in (select tribuia.user_owned_property_ids()))
  );

-- Gastos: la inmobiliaria los registra; el propietario los ve (y aprueba por RPC).
drop policy if exists property_expenses_select on tribuia.property_expenses;
create policy property_expenses_select on tribuia.property_expenses for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or property_id in (select tribuia.user_owned_property_ids())
  );
drop policy if exists property_expenses_write on tribuia.property_expenses;
create policy property_expenses_write on tribuia.property_expenses for all to authenticated
  using (tribuia.is_condominium_admin(condominium_id) and settlement_id is null)
  with check (tribuia.is_condominium_admin(condominium_id));

-- Liquidaciones: solo lectura (RPC). El propietario ve las suyas aprobadas o pagadas.
drop policy if exists owner_settlements_select on tribuia.owner_settlements;
create policy owner_settlements_select on tribuia.owner_settlements for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or (owner_profile_id = (select auth.uid()) and status in ('APPROVED', 'PAID'))
  );
drop policy if exists owner_settlement_lines_select on tribuia.owner_settlement_lines;
create policy owner_settlement_lines_select on tribuia.owner_settlement_lines for select to authenticated
  using (settlement_id in (select s.id from tribuia.owner_settlements s));

-- Firmantes: la inmobiliaria y las partes del contrato (sin el hash del token).
drop policy if exists lease_signers_select on tribuia.lease_signers;
create policy lease_signers_select on tribuia.lease_signers for select to authenticated
  using (
    tribuia.is_condominium_admin(condominium_id)
    or profile_id = (select auth.uid())
    or lease_id in (select l.id from tribuia.property_leases l where l.tenant_profile_id = (select auth.uid()))
  );

grant select, insert, update, delete on tribuia.management_agreements, tribuia.lease_guarantors, tribuia.property_expenses to authenticated;
grant select on tribuia.lease_rent_adjustments, tribuia.owner_settlements, tribuia.owner_settlement_lines to authenticated;
revoke select on tribuia.lease_signers from authenticated;
grant select (id, condominium_id, lease_id, role, name, document, email, phone, profile_id, sort_order, token_hint,
              signed_at, signed_name, signed_document, signature_image, content_hash, ip, user_agent, created_at)
  on tribuia.lease_signers to authenticated;
grant all on tribuia.management_agreements, tribuia.lease_guarantors, tribuia.lease_rent_adjustments,
  tribuia.property_expenses, tribuia.owner_settlements, tribuia.owner_settlement_lines, tribuia.lease_signers
  to service_role;

-- Tiempo real para las pantallas de la inmobiliaria.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['owner_settlements', 'lease_signers']
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

-- Prueba gratis vencida: mismas reglas que el resto de tablas.
do $$
declare
  t text;
begin
  if to_regprocedure('tribuia.expired_condominium_ids()') is null then
    return;
  end if;
  foreach t in array array['management_agreements', 'lease_guarantors', 'lease_rent_adjustments',
                           'property_expenses', 'owner_settlements', 'owner_settlement_lines', 'lease_signers']
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
