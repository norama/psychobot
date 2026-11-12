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
        .select("id, inviter_id, invited_email, status, expires_at")
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

      // The recipient is allowed to see who invited them.
      const { data: therapist, error: therapistError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", invitation.inviter_id)
        .maybeSingle()
        .overrideTypes<{ display_name: string }, { merge: false }>();

      if (therapistError || !therapist) {
        return jsonResponse(
          { message: "Nepodařilo se načíst údaje o terapeutovi." },
          500,
        );
      }

      return jsonResponse({
        invitationId: invitation.id,
        inviterName: therapist.display_name,
        expiresAt: invitation.expires_at,
      });
    } catch {
      return jsonResponse(
        { message: "Při načítání pozvání došlo k chybě." },
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
