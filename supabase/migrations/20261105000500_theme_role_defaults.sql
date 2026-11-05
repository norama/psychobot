begin;

-- Lets a workspace show a different default color per role before anyone
-- has chosen a theme, without hardcoding which color means which role in
-- frontend code. The absence of a row in workspace_theme_preferences still
-- means "no explicit choice yet" — the app then looks up the theme flagged
-- default for the viewer's role in that workspace, instead of one flat
-- fallback for everyone.
alter table public.themes
  add column default_for_role text check (default_for_role in ('therapist', 'client'));

-- Only a selectable workspace theme can be a role default; signed_out and
-- signed_in are already singletons and have no role concept.
alter table public.themes
  add constraint themes_default_for_role_workspace_only
    check (default_for_role is null or category = 'workspace');

-- At most one workspace theme defaults for therapists, and at most one for
-- clients.
create unique index themes_default_for_role_idx
  on public.themes (default_for_role)
  where default_for_role is not null;

update public.themes set default_for_role = 'therapist' where id = 'green';
update public.themes set default_for_role = 'client' where id = 'yellow';

commit;
