begin;

-- Workspaces pair two profiles, not two raw Auth accounts, and the display
-- name for each participant now lives once on their own profile row instead
-- of being duplicated per pairing. This is a new migration rather than an
-- edit to the original workspaces migration, since that one may already be
-- applied to a development database.
alter table public.workspaces
  drop constraint workspaces_therapist_id_fkey,
  drop constraint workspaces_client_id_fkey,
  drop column therapist_name,
  drop column client_name,
  add constraint workspaces_therapist_id_fkey
    foreign key (therapist_id) references public.profiles (id) on delete cascade,
  add constraint workspaces_client_id_fkey
    foreign key (client_id) references public.profiles (id) on delete cascade;

commit;
