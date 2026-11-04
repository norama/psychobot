begin;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  therapist_name text not null check (btrim(therapist_name) <> ''),
  client_name text not null check (btrim(client_name) <> ''),
  constraint workspace_distinct_users check (therapist_id <> client_id),
  constraint workspace_unique_pair unique (therapist_id, client_id)
);

create index workspaces_client_id_idx on public.workspaces (client_id);

alter table public.workspaces enable row level security;

revoke all on table public.workspaces from public, anon, authenticated;
grant select on table public.workspaces to authenticated;

create policy "Participants can read their workspace"
  on public.workspaces
  for select
  to authenticated
  using ((select auth.uid()) in (therapist_id, client_id));

commit;
