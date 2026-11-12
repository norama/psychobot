import { FunctionsHttpError } from "@supabase/supabase-js";
import { db } from "./supabase";

type CreatedInvitation = {
    message: string;
    invitationId: string;
    recipient: string;
    expiresAt: string;
    invitationUrl: string;
};

async function handleError(error: unknown): Promise<never> {
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

    throw error;
}

export async function createInvitation(
    recipient: string,
): Promise<CreatedInvitation | null> {
    const { data, error } = await db.functions.invoke<CreatedInvitation>(
        "create-invitation",
        { body: { recipient } },
    );

    if (error) await handleError(error);

    return data;
}

export type InvitationDetails = {
    invitationId: string;
    inviterName: string;
    expiresAt: string;
};

export async function getInvitation(
    token: string,
): Promise<InvitationDetails | null> {
    const { data, error } = await db.functions.invoke<InvitationDetails>(
        "get-invitation",
        {
            body: { token },
        },
    );

    if (error) await handleError(error);

    return data;
}

export async function acceptInvitation(token: string): Promise<string | null> {
    const { data, error } = await db.functions.invoke<{ workspaceId: string }>(
        "accept-invitation",
        { body: { token } },
    );

    if (error) await handleError(error);

    if (typeof data?.workspaceId !== "string" || !data.workspaceId) {
        return null;
    }

    return data.workspaceId;
}
