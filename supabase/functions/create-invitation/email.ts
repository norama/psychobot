export async function sendEmail(
  recipient: string,
  subject: string,
  textContent: string,
) {
  const apiKey = Deno.env.get("BREVO_API_KEY")?.trim();
  const sender = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim();

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
        subject,
        textContent,
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
      message: "Brevo přijalo požadavek na odeslání e-mailu.",
    });
  } catch {
    return Response.json(
      { message: "Požadavek na službu Brevo se nepodařilo dokončit." },
      { status: 502 },
    );
  }
}
