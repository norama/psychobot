-- Run as an administrator after both Google test accounts have signed in.
-- Copy their user IDs from Authentication → Users and replace both placeholders.
insert into public.workspaces (
  therapist_id,
  client_id,
  therapist_name,
  client_name
)
values (
  'REPLACE_WITH_THERAPIST_USER_UUID',
  'REPLACE_WITH_CLIENT_USER_UUID',
  'Anna Jelínková',
  'Jan Novák'
)
on conflict (therapist_id, client_id) do update
set therapist_name = excluded.therapist_name,
    client_name = excluded.client_name
returning id;
