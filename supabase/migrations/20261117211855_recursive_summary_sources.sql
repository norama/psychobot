begin;

-- Delete test messages only. All other application data remains.
delete from public.topic_messages;

alter table public.topic_messages
  drop constraint topic_messages_type_valid,
  drop constraint topic_messages_entries_private,
  drop column type,
  drop column preparation_id;

-- Dropping preparation_id also removes its index.

create table public.summary_sources (
  summary_id uuid not null
    references public.topic_messages (id) on delete cascade,

  source_id uuid not null
    references public.topic_messages (id),

  primary key (summary_id, source_id),

  constraint summary_sources_no_self_reference
    check (summary_id <> source_id)
);

-- The primary key supports outgoing-source lookups.
-- This index supports reverse lookups and source-deletion checks.
create index summary_sources_source_idx
  on public.summary_sources (source_id);

alter table public.summary_sources enable row level security;

revoke all on table public.summary_sources
  from public, anon, authenticated, service_role;

grant select on public.summary_sources to authenticated;

-- Sharing a summary never exposes its source relationships.
-- The topic_messages SELECT policy also enforces workspace access.
create policy "Authors can read own summary sources"
  on public.summary_sources
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.topic_messages m
      where m.id = summary_sources.summary_id
        and m.created_by = (select auth.uid())
    )
  );

-- Common lock for all message and source writes within a topic.
create function psychobot_private.lock_topic(p_topic_id uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_workspace_id uuid;
begin
  if p_topic_id is null then
    raise exception 'Topic is required' using errcode = '22023';
  end if;

  select workspace_id into v_workspace_id
  from public.topics
  where id = p_topic_id;

  perform psychobot_private.require_workspace(v_workspace_id);

  -- Checks after waiting must see newly committed changes.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Message writes require READ COMMITTED isolation'
      using errcode = '25000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'psychobot:topic:' || p_topic_id::text, 0
    )
  );

  -- Recheck access after acquiring the lock.
  select workspace_id into v_workspace_id
  from public.topics
  where id = p_topic_id;

  perform psychobot_private.require_workspace(v_workspace_id);
end;
$$;

-- Find an owned message, lock its topic, then read its current state.
create or replace function psychobot_private.lock_message(
  p_message_id uuid
)
returns public.topic_messages
language plpgsql security invoker set search_path = '' as $$
declare
  v_topic_id uuid;
  v_message public.topic_messages;
begin
  select topic_id into v_topic_id
  from public.topic_messages
  where id = p_message_id
    and created_by = auth.uid();

  if not found then
    raise exception 'Message not found or access denied'
      using errcode = '42501';
  end if;

  perform psychobot_private.lock_topic(v_topic_id);

  select * into v_message
  from public.topic_messages
  where id = p_message_id
    and topic_id = v_topic_id
    and created_by = auth.uid();

  if not found then
    raise exception 'Message not found or access denied'
      using errcode = '42501';
  end if;

  return v_message;
end;
$$;

-- Only drafts allow text edits, deletion, or outgoing-source changes.
create or replace function psychobot_private.require_editable(
  p_message public.topic_messages
)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_message.status is distinct from 'draft' then
    raise exception 'Message is finalized' using errcode = '23514';
  end if;
end;
$$;

-- Internal helper: callable only by its owner.
revoke all on function psychobot_private.lock_topic(uuid)
  from public, anon, authenticated, service_role;


-- Remove the old signature, public wrapper first.
drop function public.create_topic_message(
  uuid, uuid, text, text, text
);

drop function psychobot_private.create_topic_message(
  uuid, uuid, text, text, text
);

create function psychobot_private.create_topic_message(
  p_topic_id uuid,
  p_content text default '',
  p_title text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform psychobot_private.lock_topic(p_topic_id);

  if p_content is null then
    raise exception 'Content must not be null'
      using errcode = '22023';
  end if;

  insert into public.topic_messages (
    topic_id, content, title, created_by
  )
  values (
    p_topic_id, p_content, p_title, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.create_topic_message(
  p_topic_id uuid,
  p_content text default '',
  p_title text default null
)
returns uuid
language sql security invoker set search_path = '' as $$
  select psychobot_private.create_topic_message(
    p_topic_id, p_content, p_title
  );
$$;

revoke all on function psychobot_private.create_topic_message(
  uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function psychobot_private.create_topic_message(
  uuid, text, text
) to authenticated;

revoke all on function public.create_topic_message(
  uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.create_topic_message(
  uuid, text, text
) to authenticated;

-- Returns starting messages and all their recursive sources.
-- Caller must hold the topic lock.
create function psychobot_private.reachable_message_ids(
  p_start_ids uuid[]
)
returns table (id uuid)
language sql security invoker set search_path = '' as $$
  with recursive reachable(id) as (
    select starting.id
    from unnest(p_start_ids) as starting(id)

    union

    select ss.source_id
    from public.summary_sources ss
    join reachable r on r.id = ss.summary_id
  )
  select r.id from reachable r;
$$;

revoke all on function psychobot_private.reachable_message_ids(uuid[])
  from public, anon, authenticated, service_role;


create function psychobot_private.set_summary_sources(
  p_summary_id uuid,
  p_source_ids uuid[]
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_summary public.topic_messages;
begin
  -- Acquires the topic lock and checks ownership and workspace access.
  v_summary := psychobot_private.lock_message(p_summary_id);
  perform psychobot_private.require_editable(v_summary);

  if p_source_ids is null then
    raise exception 'Source IDs must not be null'
      using errcode = '22023';
  end if;

  -- Reject missing sources, null IDs, other authors and other topics.
  if exists (
    select 1
    from unnest(p_source_ids) as requested(source_id)
    left join public.topic_messages m
      on m.id = requested.source_id
    where m.id is null
      or m.created_by <> v_summary.created_by
      or m.topic_id <> v_summary.topic_id
  ) then
    raise exception 'Sources must belong to this author and topic'
      using errcode = '23514';
  end if;

  if p_summary_id = any(p_source_ids) then
    raise exception 'A message cannot reference itself'
      using errcode = '23514';
  end if;

  -- Adding summary -> source creates a cycle if that source
  -- already reaches the summary through its own sources.
  -- UNION deduplicates messages in overlapping paths.
  if exists (
    select 1
    from psychobot_private.reachable_message_ids(p_source_ids) r
    where r.id = p_summary_id
  ) then
    raise exception 'Summary sources would create a cycle'
      using errcode = '23514';
  end if;

  delete from public.summary_sources
  where summary_id = p_summary_id;

  insert into public.summary_sources (summary_id, source_id)
  select distinct p_summary_id, requested.source_id
  from unnest(p_source_ids) as requested(source_id);

  update public.topic_messages
  set updated_at = statement_timestamp()
  where id = p_summary_id;
end;
$$;

create function public.set_summary_sources(
  p_summary_id uuid,
  p_source_ids uuid[]
)
returns void
language sql security invoker set search_path = '' as $$
  select psychobot_private.set_summary_sources(
    p_summary_id, p_source_ids
  );
$$;

revoke all on function psychobot_private.set_summary_sources(
  uuid, uuid[]
) from public, anon, authenticated, service_role;

grant execute on function psychobot_private.set_summary_sources(
  uuid, uuid[]
) to authenticated;

revoke all on function public.set_summary_sources(
  uuid, uuid[]
) from public, anon, authenticated, service_role;

grant execute on function public.set_summary_sources(
  uuid, uuid[]
) to authenticated;


drop function public.finalize_preparation(uuid);
drop function psychobot_private.finalize_preparation(uuid);
drop function psychobot_private.lock_preparation(uuid, uuid);

create function psychobot_private.finalize_topic_message(
  p_message_id uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_message public.topic_messages;
begin
  -- Checks ownership and workspace access, then locks the topic.
  v_message := psychobot_private.lock_message(p_message_id);

  if btrim(v_message.content) = '' then
    raise exception 'Outgoing content must not be empty'
      using errcode = '22023';
  end if;

  -- A shared message and its sources are already frozen.
  if v_message.status = 'shared' then
    return;
  end if;

  update public.topic_messages m
  set status = 'final',
      updated_at = statement_timestamp()
  where m.status = 'draft'
    and m.id in (
      select r.id
      from psychobot_private.reachable_message_ids(
        array[v_message.id]
      ) r
    );
end;
$$;

create function public.finalize_topic_message(
  p_message_id uuid
)
returns void
language sql security invoker set search_path = '' as $$
  select psychobot_private.finalize_topic_message(p_message_id);
$$;

revoke all on function psychobot_private.finalize_topic_message(uuid)
  from public, anon, authenticated, service_role;

grant execute on function psychobot_private.finalize_topic_message(uuid)
  to authenticated;

revoke all on function public.finalize_topic_message(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.finalize_topic_message(uuid)
  to authenticated;


create or replace function psychobot_private.mark_topic_message_shared(
  p_message_id uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_message public.topic_messages;
begin
  v_message := psychobot_private.lock_message(p_message_id);

  -- Preserve shared_at and all other fields on retries.
  if v_message.status = 'shared' then
    return;
  end if;

  if btrim(v_message.content) = '' then
    raise exception 'Outgoing content must not be empty'
      using errcode = '22023';
  end if;

  -- Includes the selected message and all its recursive sources.
  if exists (
    select 1
    from psychobot_private.reachable_message_ids(
      array[v_message.id]
    ) r
    join public.topic_messages m on m.id = r.id
    where m.status = 'draft'
  ) then
    raise exception 'Message and sources must be finalized before sharing'
      using errcode = '23514';
  end if;

  update public.topic_messages
  set status = 'shared',
      shared_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = v_message.id;
end;
$$;

commit;