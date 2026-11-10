export async function createInvitationToken() {
  // 32 cryptographically random bytes, encoded as hexadecimal.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // Only this hash will be stored in the database.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  const tokenHash = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  return { token, tokenHash };
}
