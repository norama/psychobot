begin;

alter table public.topic_messages
  add column read_at timestamptz,
  add constraint topic_messages_read_at_consistent
    check (read_at is null or status = 'shared');

create function psychobot_private.mark_topic_message_read(
  p_message_id uuid
)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_topic_id uuid;
  v_read_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Only the recipient of a shared message may record its display.
  select m.topic_id into v_topic_id
  from public.topic_messages m
  join public.topics t on t.id = m.topic_id
  join public.workspaces w on w.id = t.workspace_id
  where m.id = p_message_id
    and m.status = 'shared'
    and m.created_by <> v_user_id
    and (
      (m.created_by = w.therapist_id and v_user_id = w.client_id)
      or
      (m.created_by = w.client_id and v_user_id = w.therapist_id)
    );

  if not found then
    raise exception 'Message not found or access denied'
      using errcode = '42501';
  end if;

  -- Follow the existing message-write locking convention.
  perform psychobot_private.lock_topic(v_topic_id);

  -- Recheck authorization after waiting for the lock.
  -- Repeated calls return the original timestamp.
  -- Do not change updated_at or any message content.
  update public.topic_messages m
  set read_at = coalesce(m.read_at, clock_timestamp())
  from public.topics t
  join public.workspaces w on w.id = t.workspace_id
  where m.id = p_message_id
    and m.topic_id = v_topic_id
    and t.id = m.topic_id
    and m.status = 'shared'
    and m.created_by <> v_user_id
    and (
      (m.created_by = w.therapist_id and v_user_id = w.client_id)
      or
      (m.created_by = w.client_id and v_user_id = w.therapist_id)
    )
  returning m.read_at into v_read_at;

  if not found then
    raise exception 'Message not found or access denied'
      using errcode = '42501';
  end if;

  return v_read_at;
end;
$$;

create function public.mark_topic_message_read(
  p_message_id uuid
)
returns timestamptz
language sql security invoker set search_path = '' as $$
  select psychobot_private.mark_topic_message_read(p_message_id);
$$;

revoke all on function psychobot_private.mark_topic_message_read(uuid)
  from public, anon, authenticated, service_role;

grant execute on function psychobot_private.mark_topic_message_read(uuid)
  to authenticated;

revoke all on function public.mark_topic_message_read(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.mark_topic_message_read(uuid)
  to authenticated;

commit;