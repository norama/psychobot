begin;

create table public.topics (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces (id),

  title text not null,
  description text,

  created_by uuid not null
    references public.profiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint topics_title_not_blank
    check (btrim(title) <> '')
);

create table public.topic_messages (
  id uuid primary key default gen_random_uuid(),

  topic_id uuid not null
    references public.topics (id),

  preparation_id uuid not null,

  title text,
  content text not null,

  type text not null,
  status text not null default 'draft',

  created_by uuid not null
    references public.profiles (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shared_at timestamptz,

  constraint topic_messages_type_valid
    check (type in ('entry', 'summary', 'message')),

  constraint topic_messages_status_valid
    check (status in ('draft', 'final', 'shared')),

  constraint topic_messages_entries_private
    check (type <> 'entry' or status <> 'shared'),

  constraint topic_messages_shared_at_consistent
    check (
      (status = 'shared' and shared_at is not null)
      or
      (status <> 'shared' and shared_at is null)
    )
);

-- Topic lists within a workspace.
create index topics_workspace_created_idx
  on public.topics (workspace_id, created_at, id);

-- Foreign-key lookups by author.
create index topics_created_by_idx
  on public.topics (created_by);

create index topic_messages_created_by_idx
  on public.topic_messages (created_by);

-- Message history within a topic.
create index topic_messages_topic_created_idx
  on public.topic_messages (topic_id, created_at, id);

-- Preparation ownership checks and finalization.
create index topic_messages_preparation_idx
  on public.topic_messages (preparation_id);

-- Shared messages ordered by publication time.
create index topic_messages_topic_shared_idx
  on public.topic_messages (topic_id, shared_at, id)
  where status = 'shared';

alter table public.topics enable row level security;
alter table public.topic_messages enable row level security;

revoke all on table public.topics
  from public, anon, authenticated;

revoke all on table public.topic_messages
  from public, anon, authenticated;


-- ============================================================
-- Browser permissions
-- ============================================================

grant select on public.topics to authenticated;

-- No browser DELETE permission for topics yet.

grant select on public.topic_messages to authenticated;


-- ============================================================
-- Topics
-- ============================================================

create policy "Participants can read topics"
  on public.topics
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = topics.workspace_id
        and (select auth.uid()) in (w.therapist_id, w.client_id)
    )
  );

-- ============================================================
-- Messages
-- A topic is visible only to its workspace participants through
-- the topics SELECT policy above.
-- ============================================================

create policy "Participants can read own or shared messages"
  on public.topic_messages
  for select
  to authenticated
  using (
    (
      created_by = (select auth.uid())
      or status = 'shared'
    )
    and exists (
      select 1
      from public.topics t
      where t.id = topic_messages.topic_id
    )
  );

-- Writes are available only through the named API functions below.
-- Helpers are SECURITY INVOKER and executable only by their owner.
-- They run inside a checked SECURITY DEFINER operation, so their lookups
-- can detect conflicting preparations hidden by RLS.
create schema if not exists psychobot_private;
revoke all on schema psychobot_private from public, anon, authenticated;
grant usage on schema psychobot_private to authenticated;

-- Shared authentication and workspace-membership check.
create function psychobot_private.require_workspace(p_workspace_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id
      and auth.uid() in (w.therapist_id, w.client_id)
  ) then
    raise exception 'Workspace not found or access denied' using errcode = '42501';
  end if;
end;
$$;

-- Lock one preparation and validate its author/topic. Return whether frozen.
-- The lock is global to the preparation UUID, even across different topics.
-- Every message-write operation must acquire it before changing any rows.
create function psychobot_private.lock_preparation(
  p_topic_id uuid, p_preparation_id uuid
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_workspace_id uuid;
begin
  if p_topic_id is null or p_preparation_id is null then
    raise exception 'Topic and preparation are required' using errcode = '22023';
  end if;
  select workspace_id into v_workspace_id from public.topics where id = p_topic_id;
  perform psychobot_private.require_workspace(v_workspace_id);
  -- Fresh snapshots after waiting are essential for cross-row checks.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Message writes require READ COMMITTED isolation'
      using errcode = '25000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'psychobot:preparation:' || p_preparation_id::text, 0
  ));
  if exists (
    select 1 from public.topic_messages m
    where m.preparation_id = p_preparation_id
      and (m.topic_id <> p_topic_id or m.created_by <> auth.uid())
  ) then
    raise exception 'Preparation does not belong to this author and topic'
      using errcode = '23514';
  end if;
  return exists (
    select 1 from public.topic_messages m
    where m.preparation_id = p_preparation_id and m.status in ('final', 'shared')
  );
end;
$$;

-- Find an owned message, acquire its preparation lock, then re-read it.
-- Re-reading catches a concurrent edit, deletion or finalization.
create function psychobot_private.lock_message(p_message_id uuid)
returns public.topic_messages
language plpgsql security invoker set search_path = '' as $$
declare
  v_before public.topic_messages;
  v_after public.topic_messages;
begin
  select * into v_before from public.topic_messages
  where id = p_message_id and created_by = auth.uid();
  if not found then
    raise exception 'Message not found or access denied' using errcode = '42501';
  end if;
  perform psychobot_private.lock_preparation(v_before.topic_id, v_before.preparation_id);
  select * into v_after from public.topic_messages
  where id = p_message_id and created_by = auth.uid()
    and topic_id = v_before.topic_id and preparation_id = v_before.preparation_id;
  if not found then
    raise exception 'Message not found or access denied' using errcode = '42501';
  end if;
  return v_after;
end;
$$;

create function psychobot_private.require_editable(p_message public.topic_messages)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_message.status <> 'draft' or exists (
    select 1 from public.topic_messages m
    where m.preparation_id = p_message.preparation_id and m.status in ('final', 'shared')
  ) then
    raise exception 'Preparation is finalized' using errcode = '23514';
  end if;
end;
$$;

-- create_topic
create function psychobot_private.create_topic(
  p_workspace_id uuid, p_title text, p_description text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform psychobot_private.require_workspace(p_workspace_id);
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Topic title must not be empty' using errcode = '22023';
  end if;
  insert into public.topics (workspace_id, title, description, created_by)
  values (p_workspace_id, p_title, p_description, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function public.create_topic(
  p_workspace_id uuid, p_title text, p_description text default null
)
returns uuid language sql security invoker set search_path = '' as $$
  select psychobot_private.create_topic(p_workspace_id, p_title, p_description);
$$;

-- update_topic
create function psychobot_private.update_topic(
  p_topic_id uuid, p_title text, p_description text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id from public.topics
  where id = p_topic_id and created_by = auth.uid();
  perform psychobot_private.require_workspace(v_workspace_id);
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Topic title must not be empty' using errcode = '22023';
  end if;
  update public.topics set title = p_title, description = p_description,
    updated_at = statement_timestamp()
  where id = p_topic_id and created_by = auth.uid();
  if not found then
    raise exception 'Topic not found or access denied' using errcode = '42501';
  end if;
end;
$$;

create function public.update_topic(
  p_topic_id uuid, p_title text, p_description text
)
returns void language sql security invoker set search_path = '' as $$
  select psychobot_private.update_topic(p_topic_id, p_title, p_description);
$$;

-- create_topic_message
create function psychobot_private.create_topic_message(
  p_topic_id uuid, p_preparation_id uuid, p_type text,
  p_content text default '', p_title text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if psychobot_private.lock_preparation(p_topic_id, p_preparation_id) then
    raise exception 'Preparation is finalized' using errcode = '23514';
  end if;
  if p_type is null or p_type not in ('entry', 'summary', 'message') or p_content is null then
    raise exception 'Invalid message parameters' using errcode = '22023';
  end if;
  insert into public.topic_messages (topic_id, preparation_id, type, content, title, created_by)
  values (p_topic_id, p_preparation_id, p_type, p_content, p_title, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create function public.create_topic_message(
  p_topic_id uuid, p_preparation_id uuid, p_type text,
  p_content text default '', p_title text default null
)
returns uuid language sql security invoker set search_path = '' as $$
  select psychobot_private.create_topic_message(p_topic_id, p_preparation_id, p_type, p_content, p_title);
$$;

-- update_topic_message
create function psychobot_private.update_topic_message(
  p_message_id uuid, p_content text, p_title text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_message public.topic_messages;
begin
  v_message := psychobot_private.lock_message(p_message_id);
  perform psychobot_private.require_editable(v_message);
  if p_content is null then
    raise exception 'Content must not be null' using errcode = '22023';
  end if;
  update public.topic_messages set content = p_content, title = p_title,
    updated_at = statement_timestamp() where id = v_message.id;
end;
$$;

create function public.update_topic_message(
  p_message_id uuid, p_content text, p_title text
)
returns void language sql security invoker set search_path = '' as $$
  select psychobot_private.update_topic_message(p_message_id, p_content, p_title);
$$;

-- delete_topic_message
create function psychobot_private.delete_topic_message(
  p_message_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_message public.topic_messages;
begin
  v_message := psychobot_private.lock_message(p_message_id);
  perform psychobot_private.require_editable(v_message);
  delete from public.topic_messages where id = v_message.id;
end;
$$;

create function public.delete_topic_message(
  p_message_id uuid
)
returns void language sql security invoker set search_path = '' as $$
  select psychobot_private.delete_topic_message(p_message_id);
$$;

-- finalize_preparation
create function psychobot_private.finalize_preparation(
  p_message_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_message public.topic_messages;
begin
  v_message := psychobot_private.lock_message(p_message_id);
  if v_message.type not in ('summary', 'message') then
    raise exception 'Only a summary or message can be sent' using errcode = '23514';
  end if;
  if btrim(v_message.content) = '' then
    raise exception 'Outgoing content must not be empty' using errcode = '22023';
  end if;
  if v_message.status = 'shared' then return; end if;
  if exists (
    select 1 from public.topic_messages
    where preparation_id = v_message.preparation_id and status = 'shared'
  ) then
    raise exception 'Preparation already contains a shared message' using errcode = '23514';
  end if;
  update public.topic_messages set status = 'final', updated_at = statement_timestamp()
  where preparation_id = v_message.preparation_id and status = 'draft';
end;
$$;

create function public.finalize_preparation(
  p_message_id uuid
)
returns void language sql security invoker set search_path = '' as $$
  select psychobot_private.finalize_preparation(p_message_id);
$$;

-- mark_topic_message_shared
create function psychobot_private.mark_topic_message_shared(
  p_message_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_message public.topic_messages;
begin
  v_message := psychobot_private.lock_message(p_message_id);
  if v_message.type not in ('summary', 'message') then
    raise exception 'Entries cannot be shared' using errcode = '23514';
  end if;
  if v_message.status = 'draft' or exists (
    select 1 from public.topic_messages
    where preparation_id = v_message.preparation_id and status = 'draft'
  ) then
    raise exception 'The entire preparation must be finalized before sharing'
      using errcode = '23514';
  end if;
  -- Idempotent: preserve the original publication timestamp on retries.
  if v_message.status = 'shared' then return; end if;
  if btrim(v_message.content) = '' then
    raise exception 'Outgoing content must not be empty' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.topic_messages
    where preparation_id = v_message.preparation_id and status = 'shared'
  ) then
    raise exception 'Preparation already contains a shared message' using errcode = '23514';
  end if;
  -- Only this row changes; source entries remain final and private.
  update public.topic_messages set status = 'shared',
    shared_at = statement_timestamp(), updated_at = statement_timestamp()
  where id = v_message.id;
end;
$$;

create function public.mark_topic_message_shared(
  p_message_id uuid
)
returns void language sql security invoker set search_path = '' as $$
  select psychobot_private.mark_topic_message_shared(p_message_id);
$$;

-- Explicit function privileges: helpers stay owner-only.
revoke all on function psychobot_private.require_workspace(uuid)
  from public, anon, authenticated, service_role;
revoke all on function psychobot_private.lock_preparation(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function psychobot_private.lock_message(uuid)
  from public, anon, authenticated, service_role;
revoke all on function psychobot_private.require_editable(public.topic_messages)
  from public, anon, authenticated, service_role;
revoke all on function psychobot_private.create_topic(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.create_topic(uuid, text, text) to authenticated;
revoke all on function public.create_topic(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_topic(uuid, text, text) to authenticated;
revoke all on function psychobot_private.update_topic(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.update_topic(uuid, text, text) to authenticated;
revoke all on function public.update_topic(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_topic(uuid, text, text) to authenticated;
revoke all on function psychobot_private.create_topic_message(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.create_topic_message(uuid, uuid, text, text, text) to authenticated;
revoke all on function public.create_topic_message(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_topic_message(uuid, uuid, text, text, text) to authenticated;
revoke all on function psychobot_private.update_topic_message(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.update_topic_message(uuid, text, text) to authenticated;
revoke all on function public.update_topic_message(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_topic_message(uuid, text, text) to authenticated;
revoke all on function psychobot_private.delete_topic_message(uuid)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.delete_topic_message(uuid) to authenticated;
revoke all on function public.delete_topic_message(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_topic_message(uuid) to authenticated;
revoke all on function psychobot_private.finalize_preparation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.finalize_preparation(uuid) to authenticated;
revoke all on function public.finalize_preparation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_preparation(uuid) to authenticated;
revoke all on function psychobot_private.mark_topic_message_shared(uuid)
  from public, anon, authenticated, service_role;
grant execute on function psychobot_private.mark_topic_message_shared(uuid) to authenticated;
revoke all on function public.mark_topic_message_shared(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.mark_topic_message_shared(uuid) to authenticated;

-- No direct application writes, including through service_role.
revoke all on public.topics, public.topic_messages from service_role;

commit;
