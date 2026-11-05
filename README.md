# PsychoBot development demo

React, TypeScript, Vite, and Supabase. The app uses simple Czech labels and fictional profile names.

## Plan for Friday, 20 November 2026

| Target | Deliverable | Done when |
| --- | --- | --- |
| 4 November | Google sign-in and one manually paired workspace | Both accounts see the same connection after reload. A signed-in outsider cannot open its URL. |
| By 13 November | Two-way text messages in that workspace | The client sends one message, the therapist replies, and both can reload the thread. The database enforces membership and the sender identity. |
| 16–19 November | Rehearsal and fixes | Run the script with four browser profiles. Confirm the demo URL, Google redirects, and workspace permissions. |
| 20 November | Demo with Tereza | Show one fictional case from both sides. |

Manual pairing is sufficient for this demo. Therapist invitations and client acceptance can create the same workspace row in a later milestone.

Use Supabase Auth and Postgres for sign-in, membership, and messaging. Add server-side code when provider secrets, model context selection, or private streaming enter the workflow. FastAPI makes sense when the AI workflow benefits from Python libraries, independent jobs, or its own service lifecycle. Before real-client AI use, agree on responsibility and how to handle risky situations. Keep private conversations separate from the shared workspace.

## 1. Configure a development Supabase project

1. Create a separate development project in the [Supabase Dashboard](https://supabase.com/dashboard). In its SQL Editor, run each file in [supabase/migrations](supabase/migrations) once, in filename order.
2. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173/` and add that exact URL to **Redirect URLs**. Open the app at that same origin throughout testing.
3. In the Google Auth Platform, configure the consent screen and use **External / Testing** if your accounts are outside a shared Google Workspace. Add all four Google test accounts to the test audience. Under **Data Access**, check the `openid`, `userinfo.email`, and `userinfo.profile` scopes. Create a **Web application** OAuth client and add `http://localhost:5173` under **Authorized JavaScript origins**. Add the exact callback URL displayed by Supabase's Google provider settings as a Google **Authorized redirect URI**. It normally has the form `https://<project-ref>.supabase.co/auth/v1/callback`. The localhost URL belongs in Supabase, and the Supabase callback belongs in Google.
4. Enable Google under **Authentication → Sign In / Providers** in Supabase. Put the Google OAuth client ID and secret there.
5. Find the Supabase project URL and its `sb_publishable_…` key. You’ll put both public values in `.env.local` in the next step. Keep the Google client secret and Supabase secret keys in their server-side settings.

[Google sign-in setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## 2. Start the app and pair the accounts

Use Node 24 or newer.

```sh
npm ci
cp .env.example .env.local
# Edit .env.local with your development project values
npm run dev
```

1. Open `http://localhost:5173/` in four separate browser profiles. Click **Přihlásit se přes Google** and sign in with a different Google test account in each — Anna, Jan, Petra, and one unrelated account. All four initially see **Zatím bez propojení**. Signing in also creates each account's profile automatically, named from their real Google name for now.
2. Open **Authentication → Users** in Supabase. Identify Anna's, Jan's, and Petra's accounts by their email addresses and copy their **User UIDs**. Leave the unrelated account out of this step entirely — that is what keeps it unlinked for permission checks.
3. Replace the three placeholders in [the demo fixture SQL](supabase/pair-test-accounts.sql) and run it in the Supabase SQL Editor. It overrides each of the three linked accounts' profile with its fictional demo name, and creates two workspaces: Anna is therapist to Jan, and Jan — the dual-role fixture — is therapist to Petra. Record the two returned workspace IDs. Running it again returns the same two IDs.
4. Refresh all four app windows. Anna and Petra each see one connection; Jan sees two, one per role. Open **Otevřít pracovní prostor** on any connection to confirm each side sees its own role and the fictional name of its counterpart.

## 3. Verify access

| Session | Home page | Direct URL `/?workspace=<workspace-id>` |
| --- | --- | --- |
| Anna | **Terapeut**, linked to Jan Novák | That workspace opens and survives reload |
| Jan | Both **Terapeut** (linked to Petra Dvořáková) and **Klient** (linked to Anna Jelínková) | Either of his two workspaces opens and survives reload |
| Petra | **Klient**, linked to Jan Novák | That workspace opens and survives reload |
| Unrelated Google account | **Zatím bez propojení** | **Pracovní prostor není dostupný**, for either workspace ID |
| Signed out | Google sign-in screen | Google sign-in screen |

Use the fourth browser profile for the unrelated account. Use **Odhlásit se** in one participant profile and reopen a direct URL to check signed-out access. Sign-in returns to the home page. Each participant opens a workspace from their own connection list; Jan's list has two entries.

```sh
npm test       # Local Postgres access-policy checks using PGlite
npm run build  # Type check and production bundle
```

The database policy authorizes reads by the signed-in Supabase user ID. Browser users have no write grant for pairings, and the workspace link does not grant access. The local tests run the migrations with simulated Supabase roles and user IDs. Use the browser checklist for the live Google and hosted Supabase flow.
