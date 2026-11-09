import { supabase } from "./supabase";

export async function testEmailFunction(): Promise<string> {
    if (!supabase) {
        throw new Error("Supabase is not configured");
    }

    const { data, error } = await supabase.functions.invoke<{
        message: string;
    }>("email-test", { body: {} });

    if (error) throw error;

    if (!data || typeof data.message !== "string") {
        throw new Error("Unexpected response from email-test");
    }

    return data.message;
}
