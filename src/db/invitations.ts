import { db } from "./supabase";
import { handleError } from "./util";

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
