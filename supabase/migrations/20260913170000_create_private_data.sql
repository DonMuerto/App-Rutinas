create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  recurrence_type text not null,
  specific_date date,
  content jsonb not null default '[]'::jsonb,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_name_valid check (name = btrim(name) and name <> ''),
  constraint routines_recurrence_valid check (
    (recurrence_type = 'daily' and specific_date is null)
    or
    (recurrence_type = 'specific_date' and specific_date is not null)
  ),
  constraint routines_content_array check (jsonb_typeof(content) = 'array'),
  constraint routines_position_nonnegative check (position >= 0)
);

create index routines_user_position_idx
  on public.routines (user_id, position);
create index routines_user_recurrence_idx
  on public.routines (user_id, recurrence_type);
create index routines_user_specific_date_idx
  on public.routines (user_id, specific_date);

create table public.block_completions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  scope_activity_block_id text not null,
  block_id text not null,
  block_type text not null,
  completion_date date not null,
  completed_at timestamptz not null default now(),
  constraint block_completions_scope_not_empty
    check (scope_activity_block_id <> ''),
  constraint block_completions_block_not_empty check (block_id <> ''),
  constraint block_completions_type_valid
    check (block_type in ('activity', 'checklist')),
  constraint block_completions_activity_scope_valid check (
    block_type <> 'activity' or scope_activity_block_id = block_id
  ),
  constraint block_completions_logical_key unique (
    routine_id,
    scope_activity_block_id,
    block_id,
    completion_date
  )
);

create index block_completions_routine_date_idx
  on public.block_completions (routine_id, completion_date);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger routines_set_updated_at
before update on public.routines
for each row execute function public.set_updated_at();

create function public.create_routine(
  routine_name text,
  routine_icon text,
  routine_recurrence_type text,
  routine_specific_date date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  );

  insert into public.routines (
    user_id,
    name,
    icon,
    recurrence_type,
    specific_date,
    position
  )
  select
    auth.uid(),
    routine_name,
    routine_icon,
    routine_recurrence_type,
    routine_specific_date,
    coalesce(max(position) + 1, 0)
  from public.routines
  where user_id = auth.uid()
  returning id into created_id;

  return created_id;
end;
$$;

create function public.reorder_routines(ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  supplied_count integer;
  distinct_count integer;
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  );

  perform 1
  from public.routines
  where user_id = auth.uid()
  for update;

  supplied_count := coalesce(cardinality(ordered_ids), 0);

  select count(*)
  into expected_count
  from public.routines
  where user_id = auth.uid();

  select count(distinct routine_id)
  into distinct_count
  from unnest(coalesce(ordered_ids, array[]::uuid[])) as routine_id;

  if supplied_count <> expected_count or distinct_count <> expected_count then
    raise exception using errcode = '22023', message = 'ordered_ids must contain every routine exactly once';
  end if;

  if exists (
    select 1
    from unnest(coalesce(ordered_ids, array[]::uuid[])) as requested_id
    where not exists (
      select 1
      from public.routines
      where id = requested_id and user_id = auth.uid()
    )
  ) then
    raise exception using errcode = '22023', message = 'ordered_ids contains an inaccessible routine';
  end if;

  update public.routines as routine
  set position = requested.position - 1
  from unnest(coalesce(ordered_ids, array[]::uuid[]))
    with ordinality as requested(id, position)
  where routine.id = requested.id
    and routine.user_id = auth.uid();

  get diagnostics updated_count = row_count;

  if updated_count <> expected_count then
    raise exception using errcode = '40001', message = 'routine set changed during reorder';
  end if;
end;
$$;

alter table public.routines enable row level security;
alter table public.block_completions enable row level security;

create policy routines_select_own
on public.routines
for select
to authenticated
using (user_id = auth.uid());

create policy routines_insert_own
on public.routines
for insert
to authenticated
with check (user_id = auth.uid());

create policy routines_update_own
on public.routines
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy routines_delete_own
on public.routines
for delete
to authenticated
using (user_id = auth.uid());

create policy block_completions_select_own
on public.block_completions
for select
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = block_completions.routine_id
      and routines.user_id = auth.uid()
  )
);

create policy block_completions_insert_own
on public.block_completions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.routines
    where routines.id = block_completions.routine_id
      and routines.user_id = auth.uid()
  )
);

create policy block_completions_update_own
on public.block_completions
for update
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = block_completions.routine_id
      and routines.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.routines
    where routines.id = block_completions.routine_id
      and routines.user_id = auth.uid()
  )
);

create policy block_completions_delete_own
on public.block_completions
for delete
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = block_completions.routine_id
      and routines.user_id = auth.uid()
  )
);

revoke all on table public.routines from public, anon, authenticated;
revoke all on table public.block_completions from public, anon, authenticated;
grant select, delete on table public.routines to authenticated;
grant insert (user_id, name, icon, recurrence_type, specific_date, content, position)
  on table public.routines to authenticated;
grant update (name, icon, recurrence_type, specific_date, content, position)
  on table public.routines to authenticated;
grant select, delete on table public.block_completions to authenticated;
grant insert (
  routine_id,
  scope_activity_block_id,
  block_id,
  block_type,
  completion_date
) on table public.block_completions to authenticated;
grant update (
  routine_id,
  scope_activity_block_id,
  block_id,
  block_type,
  completion_date
) on table public.block_completions to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.create_routine(text, text, text, date)
  from public, anon;
revoke all on function public.reorder_routines(uuid[]) from public, anon;
grant execute on function public.create_routine(text, text, text, date)
  to authenticated;
grant execute on function public.reorder_routines(uuid[]) to authenticated;
