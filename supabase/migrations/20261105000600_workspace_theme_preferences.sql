begin;

-- One theme choice per (person, workspace): each participant in a shared
-- workspace can pick independently, and it only affects their own view of
-- that workspace. user_id references profiles(id) directly, same as
-- workspaces.therapist_id/client_id — created after profiles so it can
-- point there from the start, rather than at auth.users.
create table public.workspace_theme_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  theme_id text not null,
  -- Fixed at 'workspace' so the composite foreign key below can only ever
  -- match a themes row whose category is 'workspace', never the fixed
  -- signed_out/signed_in rows.
  category text not null default 'workspace' check (category = 'workspace'),
  primary key (user_id, workspace_id),
  foreign key (theme_id, category) references public.themes (id, category)
);

create index workspace_theme_preferences_workspace_id_idx
  on public.workspace_theme_preferences (workspace_id);

alter table public.workspace_theme_preferences enable row level security;

revoke all on table public.workspace_theme_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.workspace_theme_preferences to authenticated;

-- A person's theme choice is a private display preference: the other
-- participant in the same workspace cannot read it, only use their own.
create policy "Owners manage their own workspace theme preference"
  on public.workspace_theme_preferences
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and (select auth.uid()) in (w.therapist_id, w.client_id)
    )
  );

commit;
