// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { sendEmail } from "../_shared/email.ts";

async function getMessageId(req: Request): Promise<string | null> {
  try {
    const body: unknown = await req.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("message_id" in body) ||
      typeof body.message_id !== "string"
    ) {
      return null;
    }

    return body.message_id.trim();
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

type MessageLookup = {
  id: string;
  status: "draft" | "final" | "shared";
  topic: {
    title: string;
    workspace: {
      therapist_id: string;
      client_id: string;
    };
  };
};

// This endpoint uses 'user' access, credentials is required.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse(
        { message: "Použijte metodu POST." },
        405,
      );
    }

    const user = ctx.userClaims;

    if (!user?.id || !user.email) {
      return jsonResponse(
        { message: "Přihlaste se prosím znovu." },
        401,
      );
    }

    const messageId = await getMessageId(req);

    if (!messageId) {
      return jsonResponse(
        { message: "Zadejte message_id." },
        400,
      );
    }

    // Fetch the message with workspace details
    const { data: message, error: messageError } = await ctx.supabase
      .from("topic_messages")
      .select(`
        id,
        status,
        topic:topics!inner(
          title,
          workspace:workspaces!inner(
            therapist_id,
            client_id
          )
        )
      `)
      .eq("id", messageId)
      .eq("created_by", user.id)
      .in("type", ["summary", "message"])
      .maybeSingle()
      .overrideTypes<MessageLookup, { merge: false }>();

    if (messageError) {
      return jsonResponse(
        { message: "Nepodařilo se načíst zprávu." },
        500,
      );
    }

    if (!message) {
      return jsonResponse(
        { message: "Zpráva nebyla nalezena nebo k ní nemáte přístup." },
        404,
      );
    }

    // An ordinary retry after successful sharing needs no further email.
    if (message.status === "shared") {
      return jsonResponse({
        shared: true,
        message: "Zpráva již byla sdílena.",
      });
    }

    // Get the counterparty (the recipient of the message)
    const workspace = message.topic.workspace;

    const recipientId = workspace.therapist_id === user.id
      ? workspace.client_id
      : workspace.client_id === user.id
      ? workspace.therapist_id
      : null;

    if (!recipientId) {
      return jsonResponse(
        { message: "K tomuto pracovnímu prostoru nemáte přístup." },
        403,
      );
    }

    // Fetch the recipient's user details from Supabase Admin API
    const {
      data: { user: recipient },
      error: recipientError,
    } = await ctx.supabaseAdmin.auth.admin.getUserById(recipientId);

    if (recipientError || !recipient?.email) {
      return jsonResponse(
        { message: "Nepodařilo se zjistit e-mail příjemce." },
        500,
      );
    }

    const recipientEmail = recipient.email;

    // Finalize the preparation of the message before sharing
    const { error: finalizePreparationError } = await ctx.supabase.rpc(
      "finalize_preparation",
      {
        p_message_id: messageId,
      },
    );

    if (finalizePreparationError) {
      return jsonResponse(
        { message: "Nepodařilo se finalizovat přípravu." },
        500,
      );
    }

    // Send a notification email to the recipient
    const title = message.topic.title;

    try {
      const emailResponse = await sendEmail(
        recipientEmail,
        `PsychoBot nová zpráva: ${title}`,
        `Byla vám zaslána nová zpráva od ${user.email} v tématu "${title}".`,
      );

      if (!emailResponse.ok) {
        return jsonResponse(
          {
            shared: false,
            message:
              "E-mailová služba nepotvrdila přijetí požadavku. Zpráva zůstává uzamčená a dosud není sdílená.",
          },
          502,
        );
      }
    } catch {
      return jsonResponse(
        {
          shared: false,
          message:
            "Nepodařilo se potvrdit přijetí požadavku e-mailovou službou. Zpráva zůstává uzamčená a dosud není sdílená.",
        },
        502,
      );
    }

    // Mark the message as shared in the database
    const { error: sharedError } = await ctx.supabase.rpc(
      "mark_topic_message_shared",
      {
        p_message_id: messageId,
      },
    );

    if (sharedError) {
      return jsonResponse(
        {
          shared: false,
          emailSubmitted: true,
          message:
            "E-mailová služba požadavek přijala, ale nepodařilo se potvrdit sdílení zprávy.",
        },
        500,
      );
    }

    return jsonResponse(
      {
        shared: true,
        emailSubmitted: true,
        message: "Zpráva byla sdílena a e-mailová služba přijala oznámení.",
      },
      201,
    );
  }),
};
