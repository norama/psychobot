// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { message: "Použijte metodu POST." },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const recipient = Deno.env.get("EMAIL_TEST_RECIPIENT")?.trim();

    if (!apiKey || !recipient) {
      return Response.json(
        { message: "Chybí konfigurace odesílání e-mailů." },
        { status: 500 },
      );
    }

    const callerEmail = ctx.userClaims?.email;

    if (
      typeof callerEmail !== "string" ||
      callerEmail.trim().toLowerCase() !== recipient.toLowerCase()
    ) {
      return Response.json(
        { message: "Test je povolen pouze pro nastavený testovací účet." },
        { status: 403 },
      );
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PsychoBot <onboarding@resend.dev>",
          to: [recipient],
          subject: "PsychoBot – test e-mailu",
          text: "Toto je test odesílání e-mailů z aplikace PsychoBot.",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return Response.json(
          {
            message: "Resend odmítl požadavek na odeslání.",
            providerStatus: response.status,
          },
          { status: 502 },
        );
      }

      return Response.json({
        message: "Resend přijal požadavek na odeslání testovacího e-mailu.",
      });
    } catch {
      return Response.json(
        { message: "Požadavek na službu Resend se nepodařilo dokončit." },
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
