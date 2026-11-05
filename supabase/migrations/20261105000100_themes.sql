begin;

-- A theme is one base hue/saturation pair. Every lightness shade used by the
-- UI (the "brand-*" ramp, see src/style.css) is derived from these two
-- numbers at render time, so this table only ever stores the seed, never a
-- precomputed shade.
--
-- "signed_out" and "signed_in" each describe a single fixed theme shown
-- before a workspace is open (sign-in screen, connection lists). "workspace"
-- rows are the user-selectable palette offered once a workspace is open.
create table public.themes (
  id text primary key,
  category text not null check (category in ('signed_out', 'signed_in', 'workspace')),
  hue integer not null check (hue between 0 and 360),
  saturation integer not null check (saturation between 0 and 100),
  constraint themes_id_category_unique unique (id, category)
);

-- Exactly one fixed theme for each non-workspace category; "workspace" keeps
-- many selectable rows.
create unique index themes_singleton_category_idx
  on public.themes (category)
  where category in ('signed_out', 'signed_in');

alter table public.themes enable row level security;

-- Hue and saturation are not sensitive, and the sign-in screen needs its
-- theme before any session exists, so read access is open to everyone.
revoke all on table public.themes from public, anon, authenticated;
grant select on table public.themes to anon, authenticated;

create policy "Anyone can read themes"
  on public.themes
  for select
  to anon, authenticated
  using (true);

insert into public.themes (id, category, hue, saturation) values
  ('grey', 'signed_out', 0, 0),
  ('brown', 'signed_in', 30, 35),
  ('red', 'workspace', 0, 70),
  ('green', 'workspace', 140, 60),
  ('blue', 'workspace', 215, 65),
  ('yellow', 'workspace', 48, 80);

commit;
