begin;

-- One profile per person, keyed by the same id Supabase Auth already
-- assigned them. A person keeps a single profile even when they are
-- therapist in one workspace and client in another.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> '')
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
-- Column-level grant: a user may rename themselves, but never touch id.
grant update (display_name) on table public.profiles to authenticated;

-- Read own profile, or the minimum (id, display_name) of a connected
-- counterpart in a shared workspace. This is not a user directory: it only
-- opens visibility between the two participants of an existing pairing.
create policy "Read own or connected counterpart profile"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.workspaces w
      where ((select auth.uid()) = w.therapist_id and w.client_id = profiles.id)
         or ((select auth.uid()) = w.client_id and w.therapist_id = profiles.id)
    )
  );

create policy "Update own display name"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Auto-create a profile for every new Auth user, seeded from whatever name
-- Google supplied. Runs as the function owner (a privileged role), so it
-- bypasses the policies above rather than needing an insert grant for
-- authenticated — nobody creates their own profile row directly.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any Auth user that already existed before this
-- migration (the current demo accounts), using the same name fallback.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

commit;
