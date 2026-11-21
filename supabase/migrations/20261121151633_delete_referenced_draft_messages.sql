begin;

create or replace function psychobot_private.delete_topic_message(
  p_message_id uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_message public.topic_messages;
begin
  -- Checks ownership and workspace access.
  -- Acquires the same topic lock used by recursive finalization,
  -- then rereads the message.
  v_message := psychobot_private.lock_message(p_message_id);
  perform psychobot_private.require_editable(v_message);

  -- Explicitly protect incoming relationships of frozen summaries.
  -- Normally their sources are already frozen too, but enforce
  -- this protection before deleting any relationships.
  if exists (
    select 1
    from public.summary_sources ss
    join public.topic_messages summary
      on summary.id = ss.summary_id
    where ss.source_id = v_message.id
      and summary.status <> 'draft'
  ) then
    raise exception 'Cannot delete a source of a finalized message'
      using errcode = '23514';
  end if;

  -- Remove relationships only; preserve all other message rows.
  delete from public.summary_sources
  where summary_id = v_message.id
     or source_id = v_message.id;

  delete from public.topic_messages
  where id = v_message.id;
end;
$$;

commit;