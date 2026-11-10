begin;

create table public.connection_invitations (
  id uuid primary key default gen_random_uuid(),

  inviter_id uuid not null
    references public.profiles(id) on delete cascade,

  invited_email text not null,

  -- Store the SHA-256 hash, never the actual invitation token.
  token_hash text not null unique,

  status text not null default 'pending',

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),

  accepted_by uuid
    references public.profiles(id) on delete cascade,

  accepted_at timestamptz,

  workspace_id uuid
    references public.workspaces(id) on delete cascade,

  -- "submitted" means the email provider accepted the request.
  delivery_status text not null default 'not_sent',

  constraint invitation_email_normalized check (
    invited_email = lower(btrim(invited_email))
    and char_length(invited_email) between 3 and 254
  ),

  constraint invitation_token_hash_format check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),

  constraint invitation_status_valid check (
    status in ('pending', 'accepted', 'revoked', 'expired')
  ),

  constraint invitation_delivery_status_valid check (
    delivery_status in ('not_sent', 'submitted', 'failed')
  ),

  constraint invitation_expiration_valid check (
    expires_at > created_at
  ),

  constraint invitation_distinct_users check (
    accepted_by is null or accepted_by <> inviter_id
  ),

  constraint invitation_acceptance_consistent check (
    (
      status = 'accepted'
      and accepted_by is not null
      and accepted_at is not null
      and workspace_id is not null
    )
    or
    (
      status <> 'accepted'
      and accepted_by is null
      and accepted_at is null
      and workspace_id is null
    )
  )
);

-- Only one pending invitation per sender and recipient.
create unique index connection_invitations_pending_pair_idx
  on public.connection_invitations (inviter_id, invited_email)
  where status = 'pending';

-- Supports listing a user's invitations, newest first.
create index connection_invitations_inviter_created_idx
  on public.connection_invitations (inviter_id, created_at desc);

alter table public.connection_invitations enable row level security;

revoke all on table public.connection_invitations
  from public, anon, authenticated;

-- The browser may read these columns, but never token_hash.
grant select (
  id,
  inviter_id,
  invited_email,
  status,
  created_at,
  expires_at,
  accepted_by,
  accepted_at,
  workspace_id,
  delivery_status
) on public.connection_invitations to authenticated;

create policy "Users can read invitations they sent"
  on public.connection_invitations
  for select
  to authenticated
  using (inviter_id = (select auth.uid()));

-- Trusted backend access.
grant select, insert, update, delete
  on public.connection_invitations to service_role;

commit;