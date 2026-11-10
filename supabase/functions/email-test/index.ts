// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

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

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { message: "Použijte metodu POST." },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const apiKey = Deno.env.get("BREVO_API_KEY")?.trim();
    const sender = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim();
    const recipient = await getRecipient(req);
    if (!recipient) {
      return Response.json(
        { message: "Zadejte platnou e-mailovou adresu." },
        { status: 400 },
      );
    }

    if (!apiKey || !sender) {
      return Response.json(
        { message: "Chybí konfigurace odesílání e-mailů." },
        { status: 500 },
      );
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Psycho Bot",
            email: sender,
          },
          replyTo: {
            name: "Psycho Bot",
            email: sender,
          },
          to: [{ email: recipient }],
          subject: "PsychoBot – test e-mailu přes Brevo",
          textContent: "Toto je test odesílání e-mailů z aplikace PsychoBot.",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return Response.json(
          {
            message: "Brevo odmítlo požadavek na odeslání.",
            providerStatus: response.status,
          },
          { status: 502 },
        );
      }

      return Response.json({
        message: "Brevo přijalo požadavek na odeslání testovacího e-mailu.",
      });
    } catch {
      return Response.json(
        { message: "Požadavek na službu Brevo se nepodařilo dokončit." },
        { status: 502 },
      );
    }
  }),
};

/*
// This endpoint uses 'user' access, credentials is required.
export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const email = ctx.userClaims?.email;

    return Response.json({
      message: `Hello ${email}!`,
    });
  }),
};
*/

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/email-test' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --header 'Authorization: Bearer <UserToken>'
*/
