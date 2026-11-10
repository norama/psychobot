import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function testEmailFunction(email: string): Promise<string> {
    if (!supabase) {
        throw new Error("Supabase is not configured");
    }

    const { data, error } = await supabase.functions.invoke<{
        message: string;
    }>("email-test", { body: { recipient: email } });

    if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        if (body && typeof body.message === "string") {
            throw new Error(body.message);
        }
    }

    if (error) throw error;

    if (!data || typeof data.message !== "string") {
        throw new Error("Unexpected response from email-test");
    }

    return data.message;
}
