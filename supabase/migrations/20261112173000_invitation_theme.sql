begin;

-- Fixed theme shown on the invitation acceptance screen, before a workspace
-- is open. Like signed_out/signed_in it is a singleton.
alter table public.themes
  drop constraint themes_category_check;

alter table public.themes
  add constraint themes_category_check
    check (category in ('signed_out', 'signed_in', 'workspace', 'invitation'));

drop index public.themes_singleton_category_idx;

create unique index themes_singleton_category_idx
  on public.themes (category)
  where category in ('signed_out', 'signed_in', 'invitation');

insert into public.themes (id, category, hue, saturation) values
  ('purple', 'invitation', 275, 50);

commit;
