-- ============================================================================
-- EdiFeasy :: Minuta de porteria, control de ingreso del personal y encuestas
-- ----------------------------------------------------------------------------
--   A. guard_log_entries: minuta digital de porteria. Las anotaciones NO se
--      editan ni se borran (libro de minuta): una correccion es una anotacion
--      nueva. Las urgentes avisan a la administracion.
--   B. staff_shifts: ingreso y salida del personal (celadores, servicios
--      generales y externos sin cuenta). Una sola jornada abierta por persona.
--   C. Encuestas: surveys, survey_questions, survey_options y survey_votes.
--      Voto por persona o por apartamento, anonimas o no. Nadie lee votos
--      ajenos: los resultados salen agregados por survey_results.
--   D. Modulos configurables 'logbook', 'staff' y 'surveys'.
--
-- Idempotente. Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. MINUTA DE PORTERIA
-- ----------------------------------------------------------------------------
create table if not exists tribuia.guard_log_entries (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  category       text not null default 'NOVEDAD',
  priority       text not null default 'NORMAL',
  description    text not null,
  apartment_id   uuid references tribuia.apartments (id) on delete set null,
  occurred_at    timestamptz not null default now(),
  attachments    jsonb not null default '[]'::jsonb,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint guard_log_category_check check (category in (
    'TURNO_INICIO', 'TURNO_FIN', 'RONDA', 'NOVEDAD', 'VISITANTE', 'PAQUETE',
    'MANTENIMIENTO', 'SEGURIDAD', 'OTRO'
  )),
  constraint guard_log_priority_check check (priority in ('NORMAL', 'IMPORTANTE', 'URGENTE')),
  constraint guard_log_description_check check (length(btrim(description)) between 3 and 2000),
  constraint guard_log_attachments_check check (
    jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5
  )
);

comment on table tribuia.guard_log_entries is
  'Minuta digital de porteria. Inmutable: sin update ni delete (las correcciones son anotaciones nuevas).';

create index if not exists idx_guard_log_condominium
  on tribuia.guard_log_entries (condominium_id, occurred_at desc);
create index if not exists idx_guard_log_created_by on tribuia.guard_log_entries (created_by);
create index if not exists idx_guard_log_apartment on tribuia.guard_log_entries (apartment_id);

drop trigger if exists trg_guard_log_tenant_ref on tribuia.guard_log_entries;
create trigger trg_guard_log_tenant_ref before insert on tribuia.guard_log_entries
  for each row execute function tribuia.tg_assert_tenant_reference();
drop trigger if exists trg_audit_guard_log on tribuia.guard_log_entries;
create trigger trg_audit_guard_log after insert on tribuia.guard_log_entries
  for each row execute function tribuia.fn_audit('CREATE');

-- Autor y hora de registro los fija la base; la hora del hecho no puede ser futura.
create or replace function tribuia.tg_guard_log_before_insert()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  if new.occurred_at > now() + interval '5 minutes' then
    raise exception 'La hora de la novedad no puede ser futura' using errcode = '22023';
  end if;
  if new.occurred_at < now() - interval '7 days' then
    raise exception 'Solo se pueden registrar novedades de los ultimos 7 dias' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_log_before_insert on tribuia.guard_log_entries;
create trigger trg_guard_log_before_insert before insert on tribuia.guard_log_entries
  for each row execute function tribuia.tg_guard_log_before_insert();

-- Novedades urgentes: aviso inmediato a la administracion.
create or replace function tribuia.tg_guard_log_notify()
returns trigger
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if new.priority = 'URGENTE' then
    insert into tribuia.notifications
      (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select new.condominium_id, m.user_id, 'Novedad urgente en porteria', left(new.description, 240),
           'INCIDENT', 'HIGH', 'guard_log_entries', new.id, '/logbook'
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id and r.code in ('ADMINISTRATOR', 'SPOKESPERSON')
     where m.condominium_id = new.condominium_id and m.status = 'ACTIVE'
       and m.user_id is distinct from new.created_by;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_guard_log_notify on tribuia.guard_log_entries;
create trigger trg_guard_log_notify after insert on tribuia.guard_log_entries
  for each row execute function tribuia.tg_guard_log_notify();

revoke execute on function tribuia.tg_guard_log_before_insert() from public, anon, authenticated;
revoke execute on function tribuia.tg_guard_log_notify() from public, anon, authenticated;

alter table tribuia.guard_log_entries enable row level security;

drop policy if exists guard_log_select on tribuia.guard_log_entries;
create policy guard_log_select on tribuia.guard_log_entries for select to authenticated
  using (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('logbook'))
  );
drop policy if exists guard_log_insert on tribuia.guard_log_entries;
create policy guard_log_insert on tribuia.guard_log_entries for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SECURITY'])
    and condominium_id not in (select tribuia.module_blocked_condominiums('logbook'))
  );
-- Sin politicas de update ni delete: la minuta es inmutable.

revoke all on tribuia.guard_log_entries from anon, authenticated;
grant select, insert on tribuia.guard_log_entries to authenticated;
grant all on tribuia.guard_log_entries to service_role;


-- ----------------------------------------------------------------------------
-- B. INGRESO Y SALIDA DEL PERSONAL
-- ----------------------------------------------------------------------------
create table if not exists tribuia.staff_shifts (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  -- Personal con cuenta (celador, servicios generales) o externo sin cuenta.
  profile_id     uuid references tribuia.profiles (id) on delete set null,
  person_name    text not null,
  role_label     text not null,
  check_in_at    timestamptz not null default now(),
  check_out_at   timestamptz,
  check_in_by    uuid references tribuia.profiles (id) on delete set null,
  check_out_by   uuid references tribuia.profiles (id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  constraint staff_shifts_range_check check (check_out_at is null or check_out_at >= check_in_at),
  constraint staff_shifts_name_check check (length(btrim(person_name)) between 2 and 120),
  constraint staff_shifts_role_check check (length(btrim(role_label)) between 2 and 60),
  constraint staff_shifts_notes_check check (coalesce(length(notes), 0) <= 500)
);

comment on table tribuia.staff_shifts is
  'Jornadas del personal: ingreso y salida. Se escriben solo por staff_check_in / staff_check_out.';

create index if not exists idx_staff_shifts_condominium
  on tribuia.staff_shifts (condominium_id, check_in_at desc);
create index if not exists idx_staff_shifts_profile on tribuia.staff_shifts (profile_id);
create index if not exists idx_staff_shifts_check_in_by on tribuia.staff_shifts (check_in_by);
create index if not exists idx_staff_shifts_check_out_by on tribuia.staff_shifts (check_out_by);
-- Una sola jornada abierta por persona con cuenta en cada conjunto.
create unique index if not exists uq_staff_shifts_open
  on tribuia.staff_shifts (condominium_id, profile_id)
  where check_out_at is null and profile_id is not null;

alter table tribuia.staff_shifts enable row level security;

drop policy if exists staff_shifts_select on tribuia.staff_shifts;
create policy staff_shifts_select on tribuia.staff_shifts for select to authenticated
  using (
    (
      tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY'])
      or profile_id = (select auth.uid())
    )
    and condominium_id not in (select tribuia.module_blocked_condominiums('staff'))
  );
-- Sin insert/update/delete directos: solo por las RPC.

revoke all on tribuia.staff_shifts from anon, authenticated;
grant select on tribuia.staff_shifts to authenticated;
grant all on tribuia.staff_shifts to service_role;

-- Marca el ingreso. Sin p_profile ni p_name: la persona marca su propio ingreso
-- (debe ser personal del conjunto). Con p_profile o p_name: lo registra la
-- porteria o la administracion (externos sin cuenta van con p_name).
create or replace function tribuia.staff_check_in(
  p_condominium uuid,
  p_profile     uuid default null,
  p_name        text default null,
  p_role_label  text default null,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_target  uuid := p_profile;
  v_name    text;
  v_role    text;
  v_manager boolean;
  v_id      uuid;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if not tribuia.module_enabled(p_condominium, 'staff') then
    raise exception 'El modulo de personal no esta habilitado' using errcode = '42501';
  end if;

  v_manager := tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'SECURITY']);

  if p_profile is null and nullif(btrim(coalesce(p_name, '')), '') is null then
    v_target := v_user;
  elsif not v_manager then
    raise exception 'Solo la porteria o la administracion registran el ingreso de otras personas'
      using errcode = '42501';
  end if;

  if v_target is not null then
    -- Debe ser personal del conjunto.
    select r.name into v_role
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id
     where m.condominium_id = p_condominium and m.user_id = v_target and m.status = 'ACTIVE'
       and r.code in ('SECURITY', 'SERVICE_STAFF', 'ADMINISTRATOR', 'SPOKESPERSON')
     order by r.level nulls last
     limit 1;
    if v_role is null then
      raise exception 'Esa persona no hace parte del personal del conjunto' using errcode = '42501';
    end if;
    select full_name into v_name from tribuia.profiles where id = v_target;
    if exists (
      select 1 from tribuia.staff_shifts
       where condominium_id = p_condominium and profile_id = v_target and check_out_at is null
    ) then
      raise exception '% ya tiene un ingreso abierto. Marca primero la salida.', v_name
        using errcode = 'P0001';
    end if;
  else
    v_name := btrim(p_name);
  end if;

  insert into tribuia.staff_shifts
    (condominium_id, profile_id, person_name, role_label, check_in_by, notes)
  values (p_condominium, v_target, left(v_name, 120),
          left(coalesce(nullif(btrim(coalesce(p_role_label, '')), ''), v_role, 'Externo'), 60),
          v_user, nullif(left(btrim(coalesce(p_notes, '')), 500), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function tribuia.staff_check_out(p_shift uuid, p_notes text default null)
returns timestamptz
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.staff_shifts%rowtype;
  v_at  timestamptz := now();
begin
  select * into v_row from tribuia.staff_shifts where id = p_shift for update;
  if v_row.id is null then
    raise exception 'La jornada no existe' using errcode = 'P0002';
  end if;
  if not (
    v_row.profile_id = auth.uid()
    or tribuia.has_role(v_row.condominium_id, array['ADMINISTRATOR', 'SECURITY'])
  ) then
    raise exception 'No puedes marcar la salida de esta persona' using errcode = '42501';
  end if;
  if v_row.check_out_at is not null then
    raise exception 'Esta jornada ya tiene salida' using errcode = 'P0001';
  end if;

  update tribuia.staff_shifts
     set check_out_at = v_at,
         check_out_by = auth.uid(),
         notes = coalesce(nullif(left(btrim(coalesce(p_notes, '')), 500), ''), notes)
   where id = p_shift;
  return v_at;
end;
$$;

-- Personal del conjunto con su estado de hoy (para "quien esta y quien no").
create or replace function tribuia.staff_roster(p_condominium uuid)
returns table (
  profile_id    uuid,
  full_name     text,
  role_label    text,
  phone         text,
  open_shift_id uuid,
  check_in_at   timestamptz,
  last_check_out_at timestamptz
)
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
begin
  if not tribuia.has_role(p_condominium, array['ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY']) then
    raise exception 'No tienes acceso al personal del conjunto' using errcode = '42501';
  end if;

  return query
    select distinct on (p.id)
           p.id, p.full_name, r.name, p.phone,
           open_shift.id, open_shift.check_in_at,
           (select max(s.check_out_at) from tribuia.staff_shifts s
             where s.condominium_id = p_condominium and s.profile_id = p.id)
      from tribuia.condominium_members m
      join tribuia.roles r on r.id = m.role_id and r.code in ('SECURITY', 'SERVICE_STAFF')
      join tribuia.profiles p on p.id = m.user_id
      left join lateral (
        select s.id, s.check_in_at from tribuia.staff_shifts s
         where s.condominium_id = p_condominium and s.profile_id = p.id and s.check_out_at is null
         order by s.check_in_at desc limit 1
      ) open_shift on true
     where m.condominium_id = p_condominium and m.status = 'ACTIVE'
     order by p.id, r.level nulls last;
end;
$$;

revoke all on function tribuia.staff_check_in(uuid, uuid, text, text, text) from public, anon;
revoke all on function tribuia.staff_check_out(uuid, text) from public, anon;
revoke all on function tribuia.staff_roster(uuid) from public, anon;
grant execute on function tribuia.staff_check_in(uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function tribuia.staff_check_out(uuid, text) to authenticated, service_role;
grant execute on function tribuia.staff_roster(uuid) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- C. ENCUESTAS
-- ----------------------------------------------------------------------------
create table if not exists tribuia.surveys (
  id             uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references tribuia.condominiums (id) on delete cascade,
  title          text not null,
  description    text,
  status         text not null default 'DRAFT',
  vote_scope     text not null default 'PERSON',
  anonymous      boolean not null default true,
  show_results   boolean not null default true,
  closes_at      timestamptz,
  opened_at      timestamptz,
  closed_at      timestamptz,
  created_by     uuid references tribuia.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint surveys_status_check check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  -- PERSON: un voto por persona. UNIT: un voto por apartamento (el primero que vote).
  constraint surveys_scope_check check (vote_scope in ('PERSON', 'UNIT')),
  constraint surveys_title_check check (length(btrim(title)) between 3 and 150),
  constraint surveys_description_check check (coalesce(length(description), 0) <= 2000)
);

create table if not exists tribuia.survey_questions (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references tribuia.surveys (id) on delete cascade,
  position    integer not null default 0,
  text        text not null,
  multiple    boolean not null default false,
  constraint survey_questions_text_check check (length(btrim(text)) between 3 and 300)
);

create table if not exists tribuia.survey_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references tribuia.survey_questions (id) on delete cascade,
  position    integer not null default 0,
  text        text not null,
  constraint survey_options_text_check check (length(btrim(text)) between 1 and 200)
);

create table if not exists tribuia.survey_votes (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references tribuia.surveys (id) on delete cascade,
  question_id  uuid not null references tribuia.survey_questions (id) on delete cascade,
  option_id    uuid not null references tribuia.survey_options (id) on delete cascade,
  voter_id     uuid references tribuia.profiles (id) on delete set null,
  apartment_id uuid references tribuia.apartments (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (question_id, option_id, voter_id)
);

-- Quien ya voto cada encuesta (por persona y, si aplica, por apartamento).
create table if not exists tribuia.survey_ballots (
  survey_id    uuid not null references tribuia.surveys (id) on delete cascade,
  voter_id     uuid not null references tribuia.profiles (id) on delete cascade,
  apartment_id uuid references tribuia.apartments (id) on delete set null,
  voted_at     timestamptz not null default now(),
  primary key (survey_id, voter_id)
);
create unique index if not exists uq_survey_ballots_unit
  on tribuia.survey_ballots (survey_id, apartment_id) where apartment_id is not null;

create index if not exists idx_surveys_condominium on tribuia.surveys (condominium_id, status, created_at desc);
create index if not exists idx_surveys_created_by on tribuia.surveys (created_by);
create index if not exists idx_survey_questions_survey on tribuia.survey_questions (survey_id, position);
create index if not exists idx_survey_options_question on tribuia.survey_options (question_id, position);
create index if not exists idx_survey_votes_survey on tribuia.survey_votes (survey_id);
create index if not exists idx_survey_votes_option on tribuia.survey_votes (option_id);
create index if not exists idx_survey_votes_voter on tribuia.survey_votes (voter_id);
create index if not exists idx_survey_votes_apartment on tribuia.survey_votes (apartment_id);
create index if not exists idx_survey_ballots_apartment on tribuia.survey_ballots (apartment_id);

drop trigger if exists trg_surveys_updated_at on tribuia.surveys;
create trigger trg_surveys_updated_at before update on tribuia.surveys
  for each row execute function tribuia.set_updated_at();
drop trigger if exists trg_surveys_lock_tenant on tribuia.surveys;
create trigger trg_surveys_lock_tenant before update on tribuia.surveys
  for each row execute function tribuia.tg_lock_tenant_columns('condominium_id');
drop trigger if exists trg_audit_surveys on tribuia.surveys;
create trigger trg_audit_surveys after insert or update or delete on tribuia.surveys
  for each row execute function tribuia.fn_audit('CREATE');

-- Una encuesta abierta o cerrada ya no se modifica (ni sus preguntas u opciones).
create or replace function tribuia.survey_is_draft(p_survey uuid)
returns boolean
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select exists (select 1 from tribuia.surveys where id = p_survey and status = 'DRAFT');
$$;

create or replace function tribuia.survey_condominium(p_survey uuid)
returns uuid
language sql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
  select condominium_id from tribuia.surveys where id = p_survey;
$$;

alter table tribuia.surveys enable row level security;
alter table tribuia.survey_questions enable row level security;
alter table tribuia.survey_options enable row level security;
alter table tribuia.survey_votes enable row level security;
alter table tribuia.survey_ballots enable row level security;

-- Encuestas: la administracion ve todas; el resto, las abiertas y cerradas.
drop policy if exists surveys_select on tribuia.surveys;
create policy surveys_select on tribuia.surveys for select to authenticated
  using (
    tribuia.user_can_access_condominium(condominium_id)
    and (status <> 'DRAFT' or tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']))
    and condominium_id not in (select tribuia.module_blocked_condominiums('surveys'))
  );
drop policy if exists surveys_insert on tribuia.surveys;
create policy surveys_insert on tribuia.surveys for insert to authenticated
  with check (
    tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON'])
    and status = 'DRAFT'
    and condominium_id not in (select tribuia.module_blocked_condominiums('surveys'))
  );
-- Solo se editan los borradores; abrir y cerrar va por RPC.
drop policy if exists surveys_update on tribuia.surveys;
create policy surveys_update on tribuia.surveys for update to authenticated
  using (status = 'DRAFT' and tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']))
  with check (status = 'DRAFT' and tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));
drop policy if exists surveys_delete on tribuia.surveys;
create policy surveys_delete on tribuia.surveys for delete to authenticated
  using (status = 'DRAFT' and tribuia.has_role(condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']));

drop policy if exists survey_questions_select on tribuia.survey_questions;
create policy survey_questions_select on tribuia.survey_questions for select to authenticated
  using (exists (select 1 from tribuia.surveys s where s.id = survey_id));
drop policy if exists survey_questions_write on tribuia.survey_questions;
create policy survey_questions_write on tribuia.survey_questions for all to authenticated
  using (
    tribuia.survey_is_draft(survey_id)
    and tribuia.has_role(tribuia.survey_condominium(survey_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
  )
  with check (
    tribuia.survey_is_draft(survey_id)
    and tribuia.has_role(tribuia.survey_condominium(survey_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
  );

drop policy if exists survey_options_select on tribuia.survey_options;
create policy survey_options_select on tribuia.survey_options for select to authenticated
  using (exists (select 1 from tribuia.survey_questions q where q.id = question_id));
drop policy if exists survey_options_write on tribuia.survey_options;
create policy survey_options_write on tribuia.survey_options for all to authenticated
  using (exists (
    select 1 from tribuia.survey_questions q
     where q.id = question_id and tribuia.survey_is_draft(q.survey_id)
       and tribuia.has_role(tribuia.survey_condominium(q.survey_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
  ))
  with check (exists (
    select 1 from tribuia.survey_questions q
     where q.id = question_id and tribuia.survey_is_draft(q.survey_id)
       and tribuia.has_role(tribuia.survey_condominium(q.survey_id), array['ADMINISTRATOR', 'SPOKESPERSON'])
  ));

-- Votos: cada quien ve solo los suyos. Se escriben por submit_survey_vote.
drop policy if exists survey_votes_select on tribuia.survey_votes;
create policy survey_votes_select on tribuia.survey_votes for select to authenticated
  using (voter_id = (select auth.uid()));
drop policy if exists survey_ballots_select on tribuia.survey_ballots;
create policy survey_ballots_select on tribuia.survey_ballots for select to authenticated
  using (voter_id = (select auth.uid()));

revoke all on tribuia.surveys, tribuia.survey_questions, tribuia.survey_options,
              tribuia.survey_votes, tribuia.survey_ballots from anon, authenticated;
grant select, insert, update, delete on tribuia.surveys, tribuia.survey_questions,
                                        tribuia.survey_options to authenticated;
grant select on tribuia.survey_votes, tribuia.survey_ballots to authenticated;
grant all on tribuia.surveys, tribuia.survey_questions, tribuia.survey_options,
             tribuia.survey_votes, tribuia.survey_ballots to service_role;

-- Abrir o cerrar (administracion). Al abrir se valida que tenga preguntas con
-- al menos 2 opciones y se avisa a los miembros del conjunto.
create or replace function tribuia.set_survey_status(p_survey uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row tribuia.surveys%rowtype;
begin
  select * into v_row from tribuia.surveys where id = p_survey for update;
  if v_row.id is null then
    raise exception 'La encuesta no existe' using errcode = 'P0002';
  end if;
  if not tribuia.has_role(v_row.condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']) then
    raise exception 'Solo la administracion abre o cierra encuestas' using errcode = '42501';
  end if;

  if p_status = 'OPEN' then
    if v_row.status <> 'DRAFT' then
      raise exception 'Solo se abren encuestas en borrador' using errcode = 'P0001';
    end if;
    if not exists (select 1 from tribuia.survey_questions where survey_id = p_survey) then
      raise exception 'Agrega al menos una pregunta' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from tribuia.survey_questions q
       where q.survey_id = p_survey
         and (select count(*) from tribuia.survey_options o where o.question_id = q.id) < 2
    ) then
      raise exception 'Cada pregunta necesita al menos dos opciones' using errcode = 'P0001';
    end if;
    if v_row.closes_at is not null and v_row.closes_at <= now() then
      raise exception 'La fecha de cierre ya paso' using errcode = 'P0001';
    end if;

    update tribuia.surveys set status = 'OPEN', opened_at = now() where id = p_survey;

    insert into tribuia.notifications
      (condominium_id, user_id, title, body, type, priority, entity, entity_id, link)
    select distinct v_row.condominium_id, m.user_id, 'Nueva encuesta: ' || v_row.title,
           coalesce(left(v_row.description, 200), 'Tu opinion cuenta. Vota en la app.'),
           'ANNOUNCEMENT'::tribuia.notification_type, 'MEDIUM'::tribuia.priority_level,
           'surveys', v_row.id, '/surveys'
      from tribuia.condominium_members m
     where m.condominium_id = v_row.condominium_id and m.status = 'ACTIVE'
       and m.user_id is distinct from auth.uid();
  elsif p_status = 'CLOSED' then
    if v_row.status <> 'OPEN' then
      raise exception 'Solo se cierran encuestas abiertas' using errcode = 'P0001';
    end if;
    update tribuia.surveys set status = 'CLOSED', closed_at = now() where id = p_survey;
  else
    raise exception 'Estado invalido' using errcode = '22023';
  end if;
  return p_status;
end;
$$;

-- Votar. p_answers: [{ "question_id": uuid, "option_ids": [uuid, ...] }]
create or replace function tribuia.submit_survey_vote(
  p_survey    uuid,
  p_answers   jsonb,
  p_apartment uuid default null
)
returns integer
language plpgsql
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_user   uuid := auth.uid();
  v_row    tribuia.surveys%rowtype;
  v_apt    uuid := p_apartment;
  v_answer jsonb;
  v_q      tribuia.survey_questions%rowtype;
  v_opts   uuid[];
  v_count  integer := 0;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  select * into v_row from tribuia.surveys where id = p_survey;
  if v_row.id is null or not tribuia.user_can_access_condominium(v_row.condominium_id) then
    raise exception 'La encuesta no existe' using errcode = 'P0002';
  end if;
  if not tribuia.module_enabled(v_row.condominium_id, 'surveys') then
    raise exception 'El modulo de encuestas no esta habilitado' using errcode = '42501';
  end if;
  if v_row.status <> 'OPEN' or (v_row.closes_at is not null and v_row.closes_at <= now()) then
    raise exception 'La encuesta no esta abierta' using errcode = 'P0001';
  end if;

  if v_row.vote_scope = 'UNIT' then
    if v_apt is null then
      select apartment_id into v_apt from tribuia.user_apartment_ids() as apartment_id limit 1;
    end if;
    if v_apt is null or v_apt not in (select tribuia.user_apartment_ids()) then
      raise exception 'Esta encuesta se vota por apartamento y no tienes uno asignado' using errcode = '42501';
    end if;
    if exists (select 1 from tribuia.survey_ballots where survey_id = p_survey and apartment_id = v_apt) then
      raise exception 'Tu apartamento ya voto en esta encuesta' using errcode = 'P0001';
    end if;
  else
    v_apt := null;
  end if;

  -- El voto es unico: la papeleta falla si la persona ya voto.
  begin
    insert into tribuia.survey_ballots (survey_id, voter_id, apartment_id) values (p_survey, v_user, v_apt);
  exception when unique_violation then
    raise exception 'Ya votaste en esta encuesta' using errcode = 'P0001';
  end;

  for v_q in select * from tribuia.survey_questions where survey_id = p_survey loop
    select answer into v_answer
      from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as answer
     where (answer ->> 'question_id')::uuid = v_q.id
     limit 1;
    select coalesce(array_agg(distinct value::uuid), '{}') into v_opts
      from jsonb_array_elements_text(coalesce(v_answer -> 'option_ids', '[]'::jsonb));

    if cardinality(v_opts) = 0 then
      raise exception 'Responde todas las preguntas' using errcode = '22023';
    end if;
    if not v_q.multiple and cardinality(v_opts) > 1 then
      raise exception 'Una pregunta admite una sola respuesta' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_opts) o
       where not exists (select 1 from tribuia.survey_options so where so.id = o and so.question_id = v_q.id)
    ) then
      raise exception 'Opcion invalida' using errcode = '22023';
    end if;

    insert into tribuia.survey_votes (survey_id, question_id, option_id, voter_id, apartment_id)
    select p_survey, v_q.id, o, case when v_row.anonymous then null else v_user end, v_apt
      from unnest(v_opts) o;
    v_count := v_count + cardinality(v_opts);
  end loop;

  return v_count;
end;
$$;

-- Resultados agregados. La administracion los ve siempre; el resto, si la
-- encuesta los muestra o ya cerro. Nunca expone quien voto que.
create or replace function tribuia.survey_results(p_survey uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = tribuia, public, pg_temp
as $$
declare
  v_row   tribuia.surveys%rowtype;
  v_admin boolean;
begin
  select * into v_row from tribuia.surveys where id = p_survey;
  if v_row.id is null or not tribuia.user_can_access_condominium(v_row.condominium_id) then
    raise exception 'La encuesta no existe' using errcode = 'P0002';
  end if;
  v_admin := tribuia.has_role(v_row.condominium_id, array['ADMINISTRATOR', 'SPOKESPERSON']);
  if not v_admin and v_row.status = 'DRAFT' then
    raise exception 'La encuesta no existe' using errcode = 'P0002';
  end if;
  if not v_admin and not v_row.show_results and v_row.status <> 'CLOSED' then
    return jsonb_build_object('hidden', true,
      'ballots', (select count(*) from tribuia.survey_ballots where survey_id = p_survey));
  end if;

  return jsonb_build_object(
    'hidden', false,
    'ballots', (select count(*) from tribuia.survey_ballots where survey_id = p_survey),
    'eligible_units', (select count(*) from tribuia.apartments where condominium_id = v_row.condominium_id),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question_id', q.id,
               'options', (
                 select jsonb_agg(jsonb_build_object(
                          'option_id', o.id,
                          'votes', (select count(*) from tribuia.survey_votes v where v.option_id = o.id))
                        order by o.position)
                   from tribuia.survey_options o where o.question_id = q.id))
             order by q.position)
        from tribuia.survey_questions q where q.survey_id = p_survey), '[]'::jsonb)
  );
end;
$$;

revoke all on function tribuia.survey_is_draft(uuid) from public, anon;
revoke all on function tribuia.survey_condominium(uuid) from public, anon;
revoke all on function tribuia.set_survey_status(uuid, text) from public, anon;
revoke all on function tribuia.submit_survey_vote(uuid, jsonb, uuid) from public, anon;
revoke all on function tribuia.survey_results(uuid) from public, anon;
grant execute on function tribuia.survey_is_draft(uuid) to authenticated, service_role;
grant execute on function tribuia.survey_condominium(uuid) to authenticated, service_role;
grant execute on function tribuia.set_survey_status(uuid, text) to authenticated, service_role;
grant execute on function tribuia.submit_survey_vote(uuid, jsonb, uuid) to authenticated, service_role;
grant execute on function tribuia.survey_results(uuid) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- D. MODULOS
-- ----------------------------------------------------------------------------
alter table tribuia.role_modules drop constraint if exists role_modules_module_check;
alter table tribuia.role_modules add constraint role_modules_module_check check (module in (
  'residents', 'visitors', 'alerts', 'announcements', 'messages', 'requests',
  'incidents', 'fines', 'admin_fees', 'expenses', 'purchases', 'documents', 'reports',
  'marketplace', 'reservations', 'logbook', 'staff', 'surveys'
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
    'marketplace', 'reservations', 'logbook', 'staff', 'surveys'
  ]::text[];
$$;

notify pgrst, 'reload schema';
