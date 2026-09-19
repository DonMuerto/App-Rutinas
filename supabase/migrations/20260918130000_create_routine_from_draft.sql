create table public.routine_draft_copy_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  routine_id uuid not null,
  primary key (user_id, request_id)
);

alter table public.routine_draft_copy_requests enable row level security;

create policy routine_draft_copy_requests_select_rpc
on public.routine_draft_copy_requests
for select
to authenticated
using (
  user_id = auth.uid()
  and request_id::text = nullif(
    current_setting('ritmo.draft_copy_request_id', true),
    ''
  )
);

create policy routine_draft_copy_requests_insert_rpc
on public.routine_draft_copy_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and request_id::text = nullif(
    current_setting('ritmo.draft_copy_request_id', true),
    ''
  )
);

create function public.create_routine_from_draft(
  source_routine_id uuid,
  document jsonb,
  routine_name text,
  routine_icon text,
  routine_recurrence_type text,
  routine_specific_date date,
  request_id uuid
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

  perform pg_catalog.set_config(
    'ritmo.draft_copy_request_id',
    request_id::text,
    true
  );

  select copy_request.routine_id
  into created_id
  from public.routine_draft_copy_requests as copy_request
  where copy_request.user_id = auth.uid()
    and copy_request.request_id = create_routine_from_draft.request_id;

  if created_id is not null then
    return created_id;
  end if;

  -- RLS makes a missing source and another user's source indistinguishable.
  if not exists (
    select 1
    from public.routines
    where id = source_routine_id
      and user_id = auth.uid()
  ) then
    return null;
  end if;

  if jsonb_typeof(document) <> 'object'
    or document -> 'schemaVersion' <> '1'::jsonb
    or jsonb_typeof(document -> 'blocks') <> 'array'
    or document - 'schemaVersion' - 'blocks' <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'invalid document envelope';
  end if;

  insert into public.routines (
    user_id,
    name,
    icon,
    recurrence_type,
    specific_date,
    content,
    position
  )
  select
    auth.uid(),
    routine_name,
    routine_icon,
    routine_recurrence_type,
    routine_specific_date,
    document,
    coalesce(max(position) + 1, 0)
  from public.routines
  where user_id = auth.uid()
  returning id into created_id;

  insert into public.routine_draft_copy_requests (
    user_id,
    request_id,
    routine_id
  ) values (
    auth.uid(),
    create_routine_from_draft.request_id,
    created_id
  );

  return created_id;
end;
$$;

revoke all on table public.routine_draft_copy_requests
  from public, anon, authenticated;
grant select on table public.routine_draft_copy_requests to authenticated;
grant insert (user_id, request_id, routine_id)
  on table public.routine_draft_copy_requests to authenticated;

revoke all on function public.create_routine_from_draft(
  uuid,
  jsonb,
  text,
  text,
  text,
  date,
  uuid
) from public, anon, authenticated;
grant execute on function public.create_routine_from_draft(
  uuid,
  jsonb,
  text,
  text,
  text,
  date,
  uuid
) to authenticated;
