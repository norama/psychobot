// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { hashInvitationToken } from "../_shared/invitationToken.ts";

type InvitationRecord = {
  id: string;
  inviter_id: string;
  invited_email: string;
  status: string;
  expires_at: string;
  accepted_by: string | null;
  workspace_id: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getToken(req: Request): Promise<string | null> {
  try {
    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("token" in body) ||
      typeof body.token !== "string" ||
      !/^[0-9a-f]{64}$/.test(body.token)
    ) {
      return null;
    }

    return body.token;
  } catch {
    return null;
  }
}

// This endpoint uses 'user' access, credentials is required.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { message: "Použijte metodu POST." },
        { status: 405 },
      );
    }

    const token = await getToken(req);

    if (!token) {
      return Response.json(
        { message: "Neplatný odkaz na pozvání." },
        { status: 400 },
      );
    }

    const tokenHash = await hashInvitationToken(token);

    // Next: find the invitation and verify the signed-in recipient.
    const userId = ctx.userClaims?.id;

    if (!userId) {
      return jsonResponse({ message: "Přihlaste se prosím znovu." }, 401);
    }

    try {
      // Read the current Auth record to check its verified email.
      const {
        data: { user },
        error: userError,
      } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);

      if (userError || !user) {
        return jsonResponse({ message: "Přihlaste se prosím znovu." }, 401);
      }

      if (!user.email || !user.email_confirmed_at) {
        return jsonResponse(
          {
            message:
              "Pro přijetí pozvání potřebujete ověřenou e-mailovou adresu.",
          },
          403,
        );
      }

      // Find the invitation using the hash calculated from the supplied token.
      const { data: invitation, error: invitationError } = await ctx
        .supabaseAdmin
        .from("connection_invitations")
        .select(
          "id, inviter_id, invited_email, status, expires_at, accepted_by, workspace_id",
        )
        .eq("token_hash", tokenHash)
        .maybeSingle()
        .overrideTypes<InvitationRecord, { merge: false }>();

      if (invitationError) {
        return jsonResponse(
          { message: "Nepodařilo se načíst pozvání." },
          500,
        );
      }

      if (!invitation) {
        return jsonResponse({ message: "Pozvání nebylo nalezeno." }, 404);
      }

      // Check the recipient before looking up or returning therapist details.
      if (invitation.invited_email !== user.email.trim().toLowerCase()) {
        return jsonResponse(
          {
            message:
              "Toto pozvání je určeno jinému účtu. Přihlaste se správným účtem.",
          },
          403,
        );
      }

      // A repeated acceptance request can return the existing result.
      if (invitation.status === "accepted") {
        if (
          invitation.accepted_by !== user.id ||
          !invitation.workspace_id
        ) {
          return jsonResponse(
            { message: "Toto pozvání nelze přijmout tímto účtem." },
            403,
          );
        }

        return jsonResponse({ workspaceId: invitation.workspace_id });
      }

      if (
        invitation.status !== "pending" ||
        Date.parse(invitation.expires_at) <= Date.now() ||
        invitation.inviter_id === user.id
      ) {
        return jsonResponse(
          { message: "Toto pozvání již není dostupné." },
          410,
        );
      }

      const findWorkspace = () =>
        ctx.supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("therapist_id", invitation.inviter_id)
          .eq("client_id", user.id)
          .maybeSingle()
          .overrideTypes<{ id: string }, { merge: false }>();

      let { data: workspace, error: workspaceError } = await findWorkspace();

      if (!workspaceError && !workspace) {
        const { data: created, error: insertError } = await ctx.supabaseAdmin
          .from("workspaces")
          .insert({
            therapist_id: invitation.inviter_id,
            client_id: user.id,
          })
          .select("id")
          .single()
          .overrideTypes<{ id: string }, { merge: false }>();

        if (insertError?.code === "23505") {
          // Another request may have created the same pair meanwhile.
          ({ data: workspace, error: workspaceError } = await findWorkspace());
        } else {
          workspace = created;
          workspaceError = insertError;
        }
      }

      if (workspaceError || !workspace) {
        console.error("Workspace creation or lookup failed", {
          invitationId: invitation.id,
          code: workspaceError?.code ?? "NO_WORKSPACE",
        });

        return jsonResponse(
          { message: "Nepodařilo se otevřít společný pracovní prostor." },
          500,
        );
      }

      // From here, the workspace exists and is usable.
      // Recording acceptance is best effort.
      try {
        const { data: recorded, error: recordError } = await ctx.supabaseAdmin
          .from("connection_invitations")
          .update({
            status: "accepted",
            accepted_by: user.id,
            accepted_at: new Date().toISOString(),
            workspace_id: workspace.id,
          })
          .eq("id", invitation.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle()
          .overrideTypes<{ id: string }, { merge: false }>();

        if (recordError || !recorded) {
          console.warn("Could not confirm invitation acceptance was recorded", {
            invitationId: invitation.id,
            workspaceId: workspace.id,
            code: recordError?.code ?? "NO_PENDING_ROW",
          });
        }
      } catch {
        console.warn("Request to record invitation acceptance failed", {
          invitationId: invitation.id,
          workspaceId: workspace.id,
        });
      }

      return jsonResponse({ workspaceId: workspace.id });
    } catch {
      return jsonResponse(
        { message: "Při přijímání pozvání došlo k chybě." },
        500,
      );
    }
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-invitation' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --header 'Authorization: Bearer <UserToken>'
*/
