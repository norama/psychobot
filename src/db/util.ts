import { FunctionsHttpError } from "@supabase/supabase-js";

export async function handleError(error: unknown): Promise<never> {
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
