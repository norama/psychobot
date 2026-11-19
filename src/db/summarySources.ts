import { db } from "./supabase";

export type SummarySource = {
    summary_id: string;
    source_id: string;
};

// Returns direct relationships visible to the current user.
// Recursive traversal stays in the database.
export async function getSummarySources(
    summaryId: string,
    signal?: AbortSignal,
): Promise<SummarySource[] | null> {
    const query = db
        .from("summary_sources")
        .select("summary_id, source_id")
        .eq("summary_id", summaryId)
        .order("source_id", { ascending: true });

    if (signal) query.abortSignal(signal);

    const { data, error } = await query.overrideTypes<
        SummarySource[],
        { merge: false }
    >();

    if (error) throw error;
    return data;
}

// Replaces the complete source list of a draft summary.
// An empty array removes all its sources.
export async function setSummarySources(
    summaryId: string,
    sourceIds: string[],
): Promise<void> {
    const { error } = await db.rpc("set_summary_sources", {
        p_summary_id: summaryId,
        p_source_ids: sourceIds,
    });

    if (error) throw error;
}
