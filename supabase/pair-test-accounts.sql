-- Run as an administrator after all three linked demo accounts have signed
-- in with Google. Copy each one's user ID from Authentication → Users and
-- replace the three placeholders below. Sign in a fourth Google test
-- account too, but leave it out of this script entirely — that is what
-- keeps it unlinked for permission checks.
--
-- Anna is therapist only. Jan is client to Anna and therapist to Petra,
-- the fixture for "one person appears as therapist in one connection and
-- client in another." Running this script again is safe and returns the
-- same two workspace IDs.
--
-- Each account already has a profile (auto-created on first sign-in from
-- their real Google name); this script overrides display_name with the
-- fictional demo name instead.
begin;

insert into public.profiles (id, display_name) values
  ('REPLACE_WITH_ANNA_USER_UUID', 'Anna Jelínková'),
  ('REPLACE_WITH_JAN_USER_UUID', 'Jan Novák'),
  ('REPLACE_WITH_PETRA_USER_UUID', 'Petra Dvořáková')
on conflict (id) do update
set display_name = excluded.display_name;

with anna_therapist_for_jan as (
  insert into public.workspaces (therapist_id, client_id)
  values ('REPLACE_WITH_ANNA_USER_UUID', 'REPLACE_WITH_JAN_USER_UUID')
  on conflict (therapist_id, client_id) do update
  set therapist_id = excluded.therapist_id
  returning 'Anna (therapist) ↔ Jan (client)' as pairing, id
),
jan_therapist_for_petra as (
  insert into public.workspaces (therapist_id, client_id)
  values ('REPLACE_WITH_JAN_USER_UUID', 'REPLACE_WITH_PETRA_USER_UUID')
  on conflict (therapist_id, client_id) do update
  set therapist_id = excluded.therapist_id
  returning 'Jan (therapist) ↔ Petra (client)' as pairing, id
)
select * from anna_therapist_for_jan
union all
select * from jan_therapist_for_petra;

commit;
