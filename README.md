# PsychoBot

**[Open the deployed demo](https://psychobot-demo.fly.dev/)**

PsychoBot is a prototype for communication and preparation between a therapist
and a client. The interface is currently in Czech.

**Use fictional content only. Do not enter real client information.
AI is not integrated yet; notes, messages, and summaries are written manually.**

## Current capabilities

- Google sign-in and sign-out.
- Therapist invitations and client acceptance.
- Protected workspaces with one therapist and one client.
- Shared topics and messaging in both directions.
- Private drafts, editing, deletion, and nested summaries.
- Finalization that freezes summaries and their source messages.
- Received/Sent lists, Markdown rendering, and copied message links.
- Standalone shared-message pages.
- E-mail notifications with direct-message and workspace-context links.
- Unread indicators and sender-visible “Zobrazeno” read timestamps.
- Receipt refresh when returning to a browser tab.

Roles belong to individual workspaces. One account can be a therapist in one
workspace and a client in another.

Private drafts and source notes are visible only to their author. Sharing a
summary does not automatically share its source messages. Shared messages are
available only to the workspace participants; knowing a link does not grant
access.

## Try the demo

Use two distinct Google accounts. Separate browser profiles make it easier
to keep both participants signed in. Each participant can use their own
Google account; shared account credentials are unnecessary.

1. Open [the therapist screen](https://psychobot-demo.fly.dev/therapist)
   and sign in with the therapist account.
2. Send an invitation to the client's Google-account E-mail address.
3. Open the invitation E-mail in the browser profile using that client account.
   Sign in with the account matching the invited E-mail address.
4. Accept the invitation.
5. Open the new workspace from each account. Create or select a shared topic.
6. Exchange fictional messages in both directions. Check E-mail notifications,
   unread indicators, and “Zobrazeno” timestamps.

Create a private draft or source note and confirm that the other participant
cannot see it. Create a summary and share it to demonstrate that its private
sources remain private.

For additional checks:

- Open notification links while signed in.
- While signed out, open a notification link and complete Google sign-in.
- Reload both standalone message pages and workspace-context links.
- Return to the sender's tab after the recipient reads a message.
- Use an unrelated third account to confirm that workspace and message links
  do not reveal their contents.

Opening a workspace-context link while signed out preserves its destination
through sign-in. Explicitly signing out from an open workspace returns to the
role overview and clears that workspace selection.

## Architecture

The frontend uses React, TypeScript, Vite, Tailwind, and React Router.

The existing hosted Supabase project provides PostgreSQL, access policies,
Google authentication with PKCE, and Edge Functions. Brevo delivers invitation
and notification E-mails.

Fly.io runs a small nginx container serving the built frontend. There is
currently no Python backend.

## Local development

Use Node.js 24 or newer.

```sh
npm ci
cp .env.example .env.local
```

Set these public frontend values in `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the Supabase publishable key, never a server secret or service-role key.

```sh
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).

The currently configured local and deployed applications use the same hosted
Supabase project and data. Invitation and notification E-mails use the hosted
application URL, including when triggered from local development.

Keep local environment files out of version control.

### Checks

```sh
npm test
npm run build
```

`npm test` runs the existing local database access-policy checks using PGlite.
It does not replace browser testing of authentication, invitations, messaging,
or E-mail delivery.

`npm run build` checks TypeScript and creates `dist/`. The current build has a
known nonblocking chunk-size warning.

## Deployment

Deployment uses the existing Fly.io app `psychobot-demo`.

| File            | Purpose                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| `Dockerfile`    | Builds with Node 24 and `npm ci`, then copies `dist/` into nginx.                   |
| `nginx.conf`    | Serves static files on port 8080 and provides SPA fallback.                         |
| `.dockerignore` | Excludes local environment files, dependencies, and other unnecessary build inputs. |
| `fly.toml`      | Defines the app, Frankfurt region, build arguments, HTTPS, and Machine settings.    |

### Redeploy

Install the Fly CLI, sign in with `fly auth login`, and ensure Docker is running.

From the repository directory:

```sh
fly deploy --local-only --ha=false
```

This builds the current local checkout, uploads the image, and updates the
existing application. GitHub pushes do not automatically deploy it.
Restarting a Machine runs the existing image and does not publish code changes.

Useful commands:

```sh
fly status -a psychobot-demo
fly logs -a psychobot-demo
```

The deployment uses one shared CPU Machine with 256 MB RAM in Frankfurt.
HTTPS is enforced. The Machine can stop while idle and starts on incoming
requests, so the first visit after inactivity may take longer.

This command deploys the frontend only. Supabase database migrations and Edge
Functions are maintained and deployed separately.

### Build-time configuration

`fly.toml` supplies `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` through `[build.args]`.

These are public frontend configuration values. Vite embeds them in the built
JavaScript, so changing them requires rebuilding and deploying the frontend.
Runtime environment changes alone cannot update an existing bundle.

Server secrets belong in their service settings. Never add Google client
secrets, Brevo API keys, Supabase server keys, or authentication tokens to
frontend configuration or this README.

### SPA routing

nginx serves built JavaScript and CSS under `/assets/`. Missing assets return 404.

Other application paths fall back to `index.html`, allowing React Router to
handle direct visits and reloads for routes such as:

- `/client`
- `/therapist`
- `/invite?token=…`
- `/message/<messageId>`
- `/client?workspace=…&topic=…&message=…`
- `/therapist?workspace=…&topic=…&message=…`

## Hosted service configuration

### Supabase authentication

In the hosted project's Authentication URL Configuration:

- Site URL: `https://psychobot-demo.fly.dev`
- Allowed redirect URLs:
  - `https://psychobot-demo.fly.dev/**`
  - `http://localhost:5000/**`
  - `http://localhost:8080/**`

The application supplies a redirect destination using its current origin,
allowing development, local Docker, and hosted sign-in to work independently.

Google OAuth uses the Supabase callback URL shown in the Google provider
settings as its authorized redirect URI. This is separate from the frontend
URLs above.

The configured identity scopes are `openid`, `userinfo.E-mail`, and
`userinfo.profile`. External Google accounts outside the configured test-user
list were successfully tested with this setup.

### E-mail links and delivery

Supabase Edge Functions use `APP_BASE_URL` for invitation and notification
links. Its hosted value is:

```text
https://psychobot-demo.fly.dev
```

Manage this value under Supabase Edge Function secrets alongside the
server-side E-mail configuration. Brevo credentials remain server-side.

If notifications stop arriving, inspect Brevo's transactional logs. A message
accepted by the E-mail API may still be blocked or fail delivery. A previous
hard bounce caused a demo recipient to be blocklisted during testing.

## Remaining limitations

- Prototype for fictional demonstrations; not ready for real client data.
- AI assistance is not implemented.
- Workspaces currently have exactly two participants.
- The interface is currently Czech only.
- Updates are not realtime; some changes require returning to a tab or reloading.
- In-app navigation protection for unsaved edits remains incomplete.
- A single automatically stopping Machine provides no high-availability setup.
