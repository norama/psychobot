import { FunctionsHttpError } from "@supabase/supabase-js";
import { db } from "./supabase";

type CreatedInvitation = {
    message: string;
    invitationId: string;
    recipient: string;
    expiresAt: string;
    invitationUrl: string;
};

export async function createInvitation(
    recipient: string,
): Promise<CreatedInvitation | null> {
    const { data, error } = await db.functions.invoke<CreatedInvitation>(
        "create-invitation",
        { body: { recipient } },
    );

    if (error instanceof FunctionsHttpError) {
        const body: unknown = await error.context.json().catch(() => null);

        if (
            typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof body.message === "string"
        ) {
            throw new Error(body.message);
        }
    }

    if (error) throw error;

    return data;
}
