alter table public.routines
  drop constraint routines_content_array;

update public.routines
set content = jsonb_build_object(
  'schemaVersion', 1,
  'blocks', content
)
where jsonb_typeof(content) = 'array';

alter table public.routines
  alter column content set default '{"schemaVersion":1,"blocks":[]}'::jsonb,
  add column revision bigint not null default 0,
  add constraint routines_revision_nonnegative check (revision >= 0),
  add constraint routines_content_envelope_v1 check (
    jsonb_typeof(content) = 'object'
    and content -> 'schemaVersion' = '1'::jsonb
    and jsonb_typeof(content -> 'blocks') = 'array'
    and content - 'schemaVersion' - 'blocks' = '{}'::jsonb
  );

create function public.enforce_routine_document_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_revision_text text;
begin
  expected_revision_text := nullif(
    current_setting('ritmo.expected_document_revision', true),
    ''
  );

  if expected_revision_text is null
    or expected_revision_text::bigint <> old.revision then
    raise exception using
      errcode = '40001',
      message = 'document revision conflict';
  end if;

  if new.revision is distinct from old.revision then
    raise exception using
      errcode = '22023',
      message = 'revision is maintained by the database';
  end if;

  -- Every accepted save advances the CAS token, including idempotent content.
  new.revision := old.revision + 1;

  return new;
end;
$$;

create trigger routines_enforce_document_revision
before update of content, revision on public.routines
for each row execute function public.enforce_routine_document_revision();

create function public.save_routine_document(
  routine_id uuid,
  expected_revision bigint,
  document jsonb
)
returns table (
  new_revision bigint,
  new_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if expected_revision < 0 then
    raise exception using errcode = '22023', message = 'invalid expected revision';
  end if;

  if jsonb_typeof(document) <> 'object'
    or document -> 'schemaVersion' <> '1'::jsonb
    or jsonb_typeof(document -> 'blocks') <> 'array'
    or document - 'schemaVersion' - 'blocks' <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'invalid document envelope';
  end if;

  perform pg_catalog.set_config(
    'ritmo.expected_document_revision',
    expected_revision::text,
    true
  );

  return query
  update public.routines
  set content = document
  where id = routine_id
    and user_id = auth.uid()
    and revision = expected_revision
  returning revision, updated_at;
end;
$$;

revoke all on function public.enforce_routine_document_revision()
  from public, anon, authenticated;
revoke all on function public.save_routine_document(uuid, bigint, jsonb)
  from public, anon;
grant execute on function public.save_routine_document(uuid, bigint, jsonb)
  to authenticated;
