-- ============================================================================
-- EdiFeasy :: Rol Contador, reportes financieros publicados y obligaciones fiscales
-- ----------------------------------------------------------------------------
-- A. Rol CONTADOR (ACCOUNTANT): solo informacion contable y fiscal.
--    - Carga y revisa la contabilidad (conexiones, archivos, estados de cuenta).
--    - Registra y revisa gastos y compras.
--    - Lleva las obligaciones fiscales (DIAN, municipio...).
--    - Publica los reportes que ven los propietarios.
--    No ve residentes, visitantes, porteria ni datos personales.
-- B. Reportes financieros: el contador o la administracion los configuran
--    (estado de situacion, resultados, presupuesto, cartera o un documento) y
--    los publican; los propietarios ven solo los publicados.
-- C. Obligaciones fiscales con vencimiento, estado y soporte.
-- D. Bucket privado `accounting` para soportes y reportes en PDF.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- A. ROL CONTADOR
-- ============================================================================
insert into tribuia.roles (code, name, description, level, is_global) values
  ('ACCOUNTANT', 'Contador', 'Informacion contable, gastos, compras y obligaciones fiscales', 50, false)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, level = excluded.level;

-- Modulos por rol: el contador tambien se puede configurar.
alter table tribuia.role_modules drop constraint if exists role_modules_role_code_check;
alter table tribuia.role_modules add constraint role_modules_role_code_check check (role_code in (
  'ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'TENANT', 'SECURITY', 'SERVICE_STAFF', 'ACCOUNTANT'
));

-- Gastos y compras: el contador los ve y los registra.
create or replace function tribuia.can_view_finance(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'], p_user);
$$;

create or replace function tribuia.can_manage_finance(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'ACCOUNTANT'], p_user);
$$;

-- Informacion contable: administracion o contador.
create or replace function tribuia.can_manage_accounting(
  p_condominium uuid,
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'ACCOUNTANT'], p_user);
$$;

grant execute on function tribuia.can_manage_accounting(uuid, uuid) to authenticated, service_role;

-- Las politicas de gastos y compras tienen la lista de roles en linea
-- (optimizacion 16.2): se recrean con el contador.
drop policy if exists expense_categories_select on tribuia.expense_categories;
create policy expense_categories_select on tribuia.expense_categories for select to authenticated
  using (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('expenses'))
  );
drop policy if exists expense_categories_write on tribuia.expense_categories;
create policy expense_categories_write on tribuia.expense_categories for all to authenticated
  using (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('expenses'))
  )
  with check (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('expenses'))
  );

drop policy if exists expenses_select on tribuia.expenses;
create policy expenses_select on tribuia.expenses for select to authenticated
  using (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('expenses'))
  );
drop policy if exists expenses_write on tribuia.expenses;
create policy expenses_write on tribuia.expenses for all to authenticated
  using (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('expenses'))
  )
  with check (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('expenses'))
  );

drop policy if exists purchases_select on tribuia.purchases;
create policy purchases_select on tribuia.purchases for select to authenticated
  using (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('purchases'))
  );
drop policy if exists purchases_write on tribuia.purchases;
create policy purchases_write on tribuia.purchases for all to authenticated
  using (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('purchases'))
  )
  with check (
    ((select tribuia.is_super_admin()) or condominium_id in (select tribuia.condominium_ids_with_role(array['ADMINISTRATOR', 'ACCOUNTANT'])))
    and condominium_id not in (select tribuia.module_blocked_condominiums('purchases'))
  );
-- purchase_items usa can_view_finance / can_manage_finance (ya incluyen al contador).

-- Informacion contable (migracion 20261021000000): el contador tambien la maneja.
drop policy if exists accounting_integrations_admin on tribuia.accounting_integrations;
create policy accounting_integrations_admin on tribuia.accounting_integrations for all to authenticated
  using (tribuia.can_manage_accounting(condominium_id))
  with check (tribuia.can_manage_accounting(condominium_id));

drop policy if exists accounting_unit_links_admin on tribuia.accounting_unit_links;
create policy accounting_unit_links_admin on tribuia.accounting_unit_links for all to authenticated
  using (tribuia.can_manage_accounting(condominium_id))
  with check (tribuia.can_manage_accounting(condominium_id));

drop policy if exists accounting_sync_runs_select on tribuia.accounting_sync_runs;
create policy accounting_sync_runs_select on tribuia.accounting_sync_runs for select to authenticated
  using (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'ACCOUNTANT']));

drop policy if exists unit_statements_select on tribuia.unit_account_statements;
create policy unit_statements_select on tribuia.unit_account_statements for select to authenticated
  using (
    (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'ACCOUNTANT'])
     or tribuia.user_owns_apartment(apartment_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists unit_movements_select on tribuia.unit_account_movements;
create policy unit_movements_select on tribuia.unit_account_movements for select to authenticated
  using (
    (tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'ACCOUNTANT'])
     or tribuia.user_owns_apartment(apartment_id))
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

-- Datos de los reportes: los propietarios los ven a traves de los reportes
-- publicados; la tabla cruda sigue legible para no romper esas vistas.
drop policy if exists financial_statements_select on tribuia.financial_statements;
create policy financial_statements_select on tribuia.financial_statements for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists budget_lines_select on tribuia.budget_lines;
create policy budget_lines_select on tribuia.budget_lines for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists portfolio_snapshots_select on tribuia.portfolio_snapshots;
create policy portfolio_snapshots_select on tribuia.portfolio_snapshots for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'OWNER', 'ACCOUNTANT'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

-- La carga de informacion contable: administracion o contador (o el servidor).
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
  if not (tribuia.can_manage_accounting(p_condominium) or auth.role() = 'service_role') then
    raise exception 'Solo la administracion o el contador pueden cargar informacion contable' using errcode = '42501';
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

-- ============================================================================
-- B. REPORTES FINANCIEROS PUBLICADOS
-- ============================================================================
create table if not exists tribuia.financial_reports (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  title          text not null,
  category       text not null default 'FINANCIAL_STATEMENTS',
  report_type    text not null,
  period         date,
  year           integer,
  summary        text,
  file_path      text,
  status         text not null default 'DRAFT',
  published_at   timestamptz,
  published_by   uuid references tribuia.profiles (id) on delete set null,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint financial_reports_title_check check (length(btrim(title)) between 3 and 140),
  constraint financial_reports_category_check check (category in (
    'FINANCIAL_STATEMENTS', 'BUDGET', 'PORTFOLIO', 'TAXES', 'AUDIT', 'ASSEMBLY', 'OTHER'
  )),
  constraint financial_reports_type_check check (report_type in (
    'BALANCE', 'RESULTS', 'BUDGET', 'PORTFOLIO', 'DOCUMENT'
  )),
  constraint financial_reports_status_check check (status in ('DRAFT', 'PUBLISHED')),
  constraint financial_reports_period_check check (
    (report_type in ('BALANCE', 'RESULTS') and period is not null)
    or (report_type = 'BUDGET' and year is not null)
    or (report_type = 'DOCUMENT' and file_path is not null)
    or report_type = 'PORTFOLIO'
  ),
  constraint financial_reports_summary_check check (summary is null or length(summary) <= 4000)
);

create index if not exists idx_financial_reports_condominium on tribuia.financial_reports (condominium_id, status, published_at desc);
create index if not exists idx_financial_reports_created_by on tribuia.financial_reports (created_by);
create index if not exists idx_financial_reports_published_by on tribuia.financial_reports (published_by);

drop trigger if exists trg_financial_reports_updated_at on tribuia.financial_reports;
create trigger trg_financial_reports_updated_at before update on tribuia.financial_reports
  for each row execute function tribuia.set_updated_at();

-- Publicar fija fecha y autor; al publicar se avisa a propietarios y directivos.
create or replace function tribuia.tg_financial_reports_publish()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED') then
    new.published_at := now();
    new.published_by := coalesce(auth.uid(), new.published_by);
  elsif new.status = 'DRAFT' then
    new.published_at := null;
    new.published_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_financial_reports_publish on tribuia.financial_reports;
create trigger trg_financial_reports_publish before insert or update on tribuia.financial_reports
  for each row execute function tribuia.tg_financial_reports_publish();

create or replace function tribuia.tg_financial_reports_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED') then
    insert into tribuia.notifications (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select distinct new.condominium_id, m.user_id,
           'Nuevo reporte financiero: ' || new.title,
           coalesce(left(new.summary, 200), 'Ya puedes consultarlo en Finanzas.'),
           'ANNOUNCEMENT'::tribuia.notification_type, 'LOW'::tribuia.priority_level,
           'financial_reports', new.id, '/finances?tab=reportes'
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id
     where m.condominium_id = new.condominium_id
       and m.status = 'ACTIVE'
       and r.code in ('OWNER', 'ADMINISTRATOR', 'SPOKESPERSON')
       and m.user_id is distinct from auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_financial_reports_notify on tribuia.financial_reports;
create trigger trg_financial_reports_notify after insert or update on tribuia.financial_reports
  for each row execute function tribuia.tg_financial_reports_notify();

drop trigger if exists trg_financial_reports_lock_tenant on tribuia.financial_reports;
create trigger trg_financial_reports_lock_tenant before update on tribuia.financial_reports
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id');

alter table tribuia.financial_reports enable row level security;

drop policy if exists financial_reports_select on tribuia.financial_reports;
create policy financial_reports_select on tribuia.financial_reports for select to authenticated
  using (
    (
      tribuia.can_manage_accounting(condominium_id)
      or (status = 'PUBLISHED' and tribuia.has_role(condominium_id, array['SPOKESPERSON', 'OWNER']))
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists financial_reports_write on tribuia.financial_reports;
create policy financial_reports_write on tribuia.financial_reports for all to authenticated
  using (tribuia.can_manage_accounting(condominium_id))
  with check (tribuia.can_manage_accounting(condominium_id));

grant select, insert, update, delete on tribuia.financial_reports to authenticated;
grant all on tribuia.financial_reports to service_role;

-- ============================================================================
-- C. OBLIGACIONES FISCALES
-- ============================================================================
create table if not exists tribuia.tax_obligations (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  name           text not null,
  authority      text not null default 'DIAN',
  period_label   text,
  due_date       date not null,
  status         text not null default 'PENDING',
  amount         numeric(14, 2),
  reference      text,
  notes          text,
  file_path      text,
  completed_at   timestamptz,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tax_obligations_name_check check (length(btrim(name)) between 3 and 140),
  constraint tax_obligations_authority_check check (authority in ('DIAN', 'MUNICIPIO', 'UGPP', 'SUPERSOLIDARIA', 'OTRA')),
  constraint tax_obligations_status_check check (status in ('PENDING', 'FILED', 'PAID', 'NOT_APPLICABLE'))
);

create index if not exists idx_tax_obligations_condominium on tribuia.tax_obligations (condominium_id, due_date);
create index if not exists idx_tax_obligations_created_by on tribuia.tax_obligations (created_by);

drop trigger if exists trg_tax_obligations_updated_at on tribuia.tax_obligations;
create trigger trg_tax_obligations_updated_at before update on tribuia.tax_obligations
  for each row execute function tribuia.set_updated_at();

create or replace function tribuia.tg_tax_obligations_completed()
returns trigger
language plpgsql
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.status in ('FILED', 'PAID') and (tg_op = 'INSERT' or old.status not in ('FILED', 'PAID')) then
    new.completed_at := now();
  elsif new.status in ('PENDING', 'NOT_APPLICABLE') then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tax_obligations_completed on tribuia.tax_obligations;
create trigger trg_tax_obligations_completed before insert or update on tribuia.tax_obligations
  for each row execute function tribuia.tg_tax_obligations_completed();

drop trigger if exists trg_tax_obligations_lock_tenant on tribuia.tax_obligations;
create trigger trg_tax_obligations_lock_tenant before update on tribuia.tax_obligations
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id');

alter table tribuia.tax_obligations enable row level security;

drop policy if exists tax_obligations_select on tribuia.tax_obligations;
create policy tax_obligations_select on tribuia.tax_obligations for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'ACCOUNTANT'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('accounting'))
  );

drop policy if exists tax_obligations_write on tribuia.tax_obligations;
create policy tax_obligations_write on tribuia.tax_obligations for all to authenticated
  using (tribuia.can_manage_accounting(condominium_id))
  with check (tribuia.can_manage_accounting(condominium_id));

grant select, insert, update, delete on tribuia.tax_obligations to authenticated;
grant all on tribuia.tax_obligations to service_role;

-- ============================================================================
-- D. STORAGE: soportes contables y reportes en PDF
-- ============================================================================
-- Rutas: <condominium_id>/reports/<archivo>  (lo ven propietarios y directivos)
--        <condominium_id>/fiscal/<archivo>   (solo administracion, vocero y contador)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accounting', 'accounting', false, 15728640, array[
  'application/pdf', 'image/png', 'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'
])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  drop policy if exists edifeasy_accounting_read on storage.objects;
  drop policy if exists edifeasy_accounting_write on storage.objects;
  drop policy if exists edifeasy_accounting_delete on storage.objects;

  execute $pol$
    create policy edifeasy_accounting_read on storage.objects for select to authenticated
    using (
      bucket_id = 'accounting'
      and (
        tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]), array['ADMINISTRATOR', 'SPOKESPERSON', 'ACCOUNTANT'])
        or (
          (storage.foldername(name))[2] = 'reports'
          and tribuia.has_role(tribuia.safe_uuid((storage.foldername(name))[1]), array['OWNER'])
        )
      )
    )
  $pol$;

  execute $pol$
    create policy edifeasy_accounting_write on storage.objects for insert to authenticated
    with check (
      bucket_id = 'accounting'
      and (storage.foldername(name))[2] in ('reports', 'fiscal')
      and tribuia.can_manage_accounting(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;

  execute $pol$
    create policy edifeasy_accounting_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'accounting'
      and tribuia.can_manage_accounting(tribuia.safe_uuid((storage.foldername(name))[1]))
    )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'Sin privilegios para crear politicas de storage.objects. Crealas desde el Dashboard (Storage -> Policies).';
end
$$;

-- ============================================================================
-- E. REALTIME Y PRUEBA GRATIS
-- ============================================================================
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['financial_reports', 'tax_obligations']
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

do $$
declare
  t text;
begin
  if to_regprocedure('tribuia.expired_condominium_ids()') is null then
    return;
  end if;
  foreach t in array array['financial_reports', 'tax_obligations']
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
