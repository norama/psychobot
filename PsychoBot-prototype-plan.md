# PsychoBot prototype plan — 5 November 2026

Goal for Friday, 20 November 2026

A therapist invites a client, the client signs in with Google and explicitly accepts the connection, and both exchange persistent messages in a protected shared workspace. Show fictional data with separate therapist, client, and unrelated test accounts. Private AI conversation remains a later milestone.

Assume roughly 4–6 focused development hours per working day. Allow five build days plus two days for integration and fixes. These are estimates for an experienced React/TypeScript developer using Copilot, with Google sign-in already working. Email setup and invitation handling are the largest uncertainties. If work starts on 5 November, seven working days run through 13 November, leaving 16–19 November for rehearsal and remaining fixes.

| Day | Main outcome | Completion check |
| --- | --- | --- |
| 1 | Tailwind UI, Czech localization setup, shared profiles, roles per connection, connection selection | One account can appear as therapist in one connection and client in another, with the right view after reload. |
| 2 | Therapist invitation and client acceptance | The intended client accepts an emailed link and both accounts see one persistent connection. |
| 3 | Two-way messages with database permissions | A client message and therapist reply persist. An unrelated account cannot read or send through the API. |
| 4 | Topics, chronological views, read/unread | Both users can navigate the conversation, with unread status stored per recipient. |
| 5 | New-message updates, toasts, and email notification | The recipient receives one notification for a new message, and email failure leaves the message intact. |
| 6–7 | Integration, fixes, and optional author-only drafts | The complete demo flow works on the demo URL with three accounts. |

Design decisions to carry into Copilot

- Keep React, TypeScript, Tailwind, and Supabase. A Supabase Edge Function can handle trusted invitation and email work. Reconsider FastAPI when implementing the Python/AI workflow.
- Set up i18next and react-i18next on Day 1 with a single Czech translation file, such as src/locales/cs.json. Use Czech as the fixed active and fallback language for the demo. Give user-facing labels, validation errors, empty states, and notifications translation keys. Use locale-aware date and number formatting. Keep database status values stable and display their translated labels. Add English resources and a language selector when the second language is needed.
- Use the existing Supabase Auth UUID as the internal user identifier. A profile's primary key can reference auth.users.id. Google identities already live in Supabase Auth. A second Google-ID-to-app-UUID mapping adds work without helping this prototype.
- Keep one profiles table for every person, containing the internal user ID and display name. A person has one profile even when they act as therapist in some connections and client in others. Add optional therapist-specific details later only when distinct fields are needed.
- Derive therapist/client roles from each workspace pairing. Both therapist_id and client_id reference profiles.id. Keep the distinct-user and unique-directed-pair constraints, while allowing each user to occur in many pairings on either side. Every signed-in user can send an invitation to any email address and becomes the therapist in the resulting connection. The intended recipient becomes the client after signing in with the invited email address and explicitly accepting. Users can participate on either side across different connections. A therapist/client view selector filters the interface and does not grant workspace access. Users may edit their own display name through permitted fields.
- Allow users to read their own profile. Connected participants can read the minimum counterpart information the UI needs, initially a display name. Access to the complete user directory is a separate future superadmin feature. Permission to read text must be explicit. Keep the superadmin UI outside this demo's required scope.
- Keep default Supabase encryption at rest, consistent with the agreed future need for full-text and vector search. Put text bodies in separate tables with their own grants and RLS. IDs and foreign keys alone do not enforce text privacy.
- Day 1 deliberately revisits the earlier shortcut of storing names on workspaces. Migrate existing fictional names into profiles and preserve the current pairing. Remove the redundant workspace name fields only after the application reads profiles successfully.
- Each new table, RPC, and subscription gets its intended permissions when introduced. Run permission checks with participant and unrelated user sessions. A hidden button or role-specific page is only part of the UI.

**Day 1 — UI and account structure**

Use approximately one third of the day for styling and the rest for profile data, permissions, and integration. Move invitations to Day 2 so the day's outcome stays coherent.

1. Add Tailwind with a small shared set of colors, spacing, and typography. Extract reusable elements as the screens need them, initially Button, TextField, Dialog, AppShell, and ConnectionCard. Set up i18next and react-i18next with one Czech translation file and move existing UI text into translation keys. Keep Czech fixed as the active and fallback language. Check plural forms for counts when adding them and format dates and numbers according to the locale.
2. Build a simple signed-out home screen with a short explanation and sign-in action. Google sign-in identifies the person. If desired, offer Terapeut and Klient as view choices, and allow switching after sign-in. Every signed-in user can use either view. Workspace membership determines access to existing connections.
3. Add the profile migration and a repeatable setup for the demo accounts. Reuse the current user UUIDs and preserve the existing connection. Keep the unrelated account unlinked. Include a fixture where one person appears as therapist in one connection and client in another.
4. Add home-screen sections or views for Moji klienti and Moji terapeuti. A person may have entries in both. Label their role within each selected workspace and provide useful empty states. The therapist view shows the invitation entry point for every signed-in user, with its functionality implemented on Day 2.
5. Support selecting a connection and opening a stable URL for that workspace. Loading, error, no-connection, and inaccessible-workspace states should be distinct.
6. Verify that each account reloads correctly, and that the unrelated account cannot read another profile's protected data or workspace through a direct request. Updating a profile or switching views must not change workspace membership. Check that an unlinked user can start an invitation without gaining access to any existing workspace.

Done when each person has one persistent profile, the existing pair can open the same workspace, and navigation works at localhost port 5000. Verify the dual-role fixture in both views. Connections grant access only to their own workspace, without extending access to other clients or therapists of either participant.

**Day 2 — Invitation and acceptance**

Treat a therapist–client invitation as a product record. Supabase Auth's inviteUserByEmail invites someone to create an Auth account and has different behavior for existing users. An application invitation supports both an existing Google user and a client who has never signed in.

1. Add connection_invitations with inviter ID, intended client email, expiry, token hash, status, and accepted client/workspace references as needed. Use pending, accepted, revoked, and expired as the supported lifecycle, with expiry checked during acceptance. Generate a random token in trusted code.
2. Any signed-in user enters an email address. Trusted code verifies the authenticated identity, derives the inviter ID from it, records the invitation with that user as the intended therapist, and sends an application link using a transactional email provider. Keep provider credentials in the server environment. The application supports inviting any email address. During the demo, use fictional cases and test recipients.
3. The link opens an invitation screen. If sign-in is needed, preserve the invitation destination through the Google OAuth round trip. After authentication and recipient verification, show the inviter's display name and account email so the recipient can decide whether to trust and accept the connection. Create the shared workspace only after explicit acceptance. Opening or previewing an email link must not consume the invitation.
4. During acceptance, verify the token, expiry, current status, and intended email against the authenticated user's verified identity. Any intended recipient can accept as the client, including a person who is already a therapist in another workspace. Create the workspace and mark acceptance atomically. Reject self-connections and a different signed-in account. Repeated acceptance should return the existing connection.
5. Show pending invitations on the therapist screen. Offer a copy-link fallback if email delivery fails, while clearly displaying the delivery status. Keep failures recoverable without creating multiple connections.
6. Check invitation creation by a previously unlinked account, the fresh-client path, existing-client path, existing-therapist-as-client path, wrong-account path, expired/revoked link, repeated acceptance, and sign-in followed by return to the invitation. An invitation on its own must not grant workspace access.

Done when one therapist sends the invitation, the correct client accepts, and both see the same connection after reload. The unrelated account cannot accept it. If email setup uses up the day, finish the acceptance flow with a copied link, record email delivery as unfinished, and use reserve time to complete it.

**Day 3 — Persistent two-way messaging**

1. Add messages with workspace ID, sender ID, text-body reference, and server timestamp. Store the actual text separately in message_contents. Create the body and message together in one transaction so partial writes do not leave orphan records. Establish a stable chronological order.
2. Permit only workspace participants to read messages and their bodies. When sending, require sender_id to match the authenticated user and require membership in that workspace. Prevent references to content belonging to another workspace. Use each workspace's pairing to establish the person's role when role-specific behavior is needed.
3. Build a simple chronological thread, a multiline composer, and an explicit send button. Show sender, time, loading, empty, pending-send, and send-failure states. Retain the unsent text after an error and give it a clear retry path. Use an idempotency key for a send attempt so retrying an uncertain request does not duplicate a message.
4. Reload or manually refresh to fetch the current thread. Automatic updates are Day 5. The core send/read flow should already work with two browser profiles.
5. Verify client-to-therapist and therapist-to-client delivery, persistence after reload, denial for the unrelated account, forged sender IDs, and a retry after a failed or uncertain send. In an A → B → C fixture, A is therapist to B, and B is therapist to C. B participates in both workspaces, while A and C can read only their respective workspace. Use a fourth unrelated fixture identity to retain the outsider check.

Done when both participants exchange messages, reload, and see the same thread. Keep edits, deletion, attachments, and persisted drafts as later scope.

**Day 4 — Navigation and reading state**

Add a small topics table within each workspace. Start with a default Obecné topic and one topic per message. Offer Vše and topic views, group messages by day, and use a date filter only if it helps the demonstration. Constrain topic/message references to the same workspace.

Record reading status per recipient, for example message_reads(message_id, user_id, read_at), with appropriate uniqueness and permissions. Mark incoming messages read when their thread is actually displayed in the active window. Derive unread counts and the Nové marker from those records. Sending a message must not mark the recipient's copy read.

**Day 5 — Notifications**

Add automatic updates using a subscription whose authorization follows workspace access. On an incoming message, refresh the affected thread/list and show a toast where appropriate. Re-fetch after reconnect so missed events are recovered. Avoid duplicate messages, repeated toasts, and notifications for the sender's own message.

Reuse the email delivery provider for generic notifications such as Máte novou zprávu v aplikaci. Include a workspace link. Email contains no message body or therapy topic. Track notification delivery and retries separately from the saved message. A notification failure must not roll back a successfully sent message, and retrying the same notification should avoid duplicate delivery as far as the provider permits.

**Days 6–7 and 16–19 November — Completion and rehearsal**

Finish spillover work, configure the demo URL and OAuth redirects, and rehearse from the emailed invitation through the therapist's reply. Recheck permissions after introducing profiles, topics, notifications, and any RPCs. Keep versioned migrations in the repository and align the migration history with the current development database before applying changes.

If the core flow is stable, add persisted drafts in a separate owner-only table. Show that a draft survives reload for its author and remains inaccessible to the other participant and the unrelated account. Publishing a draft should create the shared message atomically. Separate draft and published text access throughout the API, search, and notification paths.

A complete November demo has a simple home screen, shared profiles, therapist/client roles per connection, invite/accept connection, connection selection, persistent two-way messages, topics and dates, unread status, and new-message notifications. Drafts are the first optional addition. Keep the remaining time available for repairs and a dependable fictional demonstration.

Daily handoff to Copilot

Use this conversation for product planning, architectural decisions, progress review, and changes to scope. Carry out each day's implementation in VSCode with the Copilot agent. Bring major problems or change requests back here as they arise, and review progress at the end of each development day.

1. Give Copilot the overall product context, the agreed architectural decisions, a summary of what is already working, and the next day's scope and completion checks. Keep a copy of these decisions and the current plan in the repository so the agent can consult them.
2. Ask Copilot to inspect the current code, schema, and migration history, then propose a short sequence of implementation steps. Identify any conflict between the plan and the code before changing the architecture.
3. Implement one small working step at a time, pausing at agreed checkpoints so the developer can review the diff and test the affected flow. Preserve existing accounts and connections, and keep unrelated features outside the day's scope.
4. At the end, build the app, exercise the affected flow with the relevant accounts, and check new access rules with an unrelated account. Ask Copilot for a concise handoff covering completed work, important decisions and migrations, verification, outstanding issues, and a suggested next step.
5. Bring that handoff back to this conversation. Adjust the following day's scope from the actual result. Carry unfinished work forward explicitly. Return earlier when an architectural question, blocker, or change request would affect subsequent implementation.

Sources checked on 5 November 2026

- Supabase user profiles and references to auth.users — https://supabase.com/docs/guides/auth/managing-user-data
- Supabase identity records — https://supabase.com/docs/guides/auth/identities
- Auth account invitations — https://supabase.com/docs/guides/auth/users
- Supabase Auth SMTP restrictions — https://supabase.com/docs/guides/auth/auth-smtp
- Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security
- Realtime authorization — https://supabase.com/docs/guides/realtime/authorization

