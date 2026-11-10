// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { sendEmail } from "./email.ts";
import { createInvitationToken } from "./util.ts";

async function getRecipient(req: Request): Promise<string | null> {
  try {
    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("recipient" in body) ||
      typeof body.recipient !== "string"
    ) {
      return null;
    }

    const recipient = body.recipient.trim();

    if (
      recipient.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
    ) {
      return null;
    }

    return recipient;
  } catch {
    return null;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// This endpoint uses 'user' access, credentials is required.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse(
        { message: "Použijte metodu POST." },
        405,
      );
    }

    const inviter = ctx.userClaims;

    if (!inviter?.id || !inviter.email) {
      return jsonResponse(
        { message: "Přihlaste se prosím znovu." },
        401,
      );
    }

    const recipientInput = await getRecipient(req);

    if (!recipientInput) {
      return jsonResponse(
        { message: "Zadejte platnou e-mailovou adresu." },
        400,
      );
    }

    const recipient = recipientInput.toLowerCase();

    if (recipient === inviter.email.trim().toLowerCase()) {
      return jsonResponse(
        { message: "Nemůžete pozvat sami sebe." },
        400,
      );
    }

    try {
      const appBaseUrl = Deno.env.get("APP_BASE_URL");

      if (!appBaseUrl) {
        return jsonResponse(
          { message: "Chybí konfigurace adresy aplikace." },
          500,
        );
      }

      const invitationUrl = new URL("/invite", appBaseUrl);

      // Expired invitations must stop blocking a new invitation
      // to the same recipient.
      const { error: expirationError } = await ctx.supabaseAdmin
        .from("connection_invitations")
        .update({ status: "expired" })
        .eq("inviter_id", inviter.id)
        .eq("invited_email", recipient)
        .eq("status", "pending")
        .lte("expires_at", new Date().toISOString());

      if (expirationError) {
        return jsonResponse(
          { message: "Nepodařilo se připravit pozvání." },
          500,
        );
      }

      const { token, tokenHash } = await createInvitationToken();

      const { data: invitation, error } = await ctx.supabaseAdmin
        .from("connection_invitations")
        .insert({
          inviter_id: inviter.id,
          invited_email: recipient,
          token_hash: tokenHash,
        })
        .select("id, invited_email, expires_at")
        .single();

      if (error) {
        if (error.code === "23505") { // Unique constraint violation (duplicate pending invitation)
          return jsonResponse(
            {
              message: "Pro tuto adresu již máte nevyřízené pozvání.",
            },
            409,
          );
        }

        return jsonResponse(
          { message: "Nepodařilo se vytvořit pozvání." },
          500,
        );
      }

      invitationUrl.searchParams.set("token", token);

      const emailResponse = await sendEmail(
        recipient,
        "Pozvání do PsychoBot",
        `Byli jste pozváni do PsychoBot.

Pro přijetí pozvání otevřete následující odkaz:
${invitationUrl.toString()}

Přihlaste se účtem Google s adresou ${recipient}.
Pozvání platí 7 dní.`,
      );

      const deliveryStatus = emailResponse.ok ? "submitted" : "failed";

      const { error: deliveryError } = await ctx.supabaseAdmin
        .from("connection_invitations")
        .update({ delivery_status: deliveryStatus })
        .eq("id", invitation.id);

      let message = emailResponse.ok
        ? "Pozvání bylo vytvořeno a předáno k odeslání."
        : "Pozvání bylo vytvořeno, ale odeslání e-mailu se nepodařilo potvrdit. Odkaz si můžete zkopírovat.";

      if (deliveryError) {
        console.error(
          "Saving email submission status failed:",
          deliveryError.code,
        );
        message += " Stav odeslání se nepodařilo uložit.";
      }

      return jsonResponse(
        {
          message,
          invitationId: invitation.id,
          recipient: invitation.invited_email,
          expiresAt: invitation.expires_at,
          invitationUrl: invitationUrl.toString(),
          deliveryStatus,
        },
        201,
      );
    } catch {
      return jsonResponse(
        { message: "Při vytváření pozvání došlo k chybě." },
        500,
      );
    }
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-invitation' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --header 'Authorization: Bearer <UserToken>'
*/
