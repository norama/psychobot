import { db } from "./supabase";

export type Topic = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TopicInput = {
  title: string;
  description?: string | null;
};

export async function getTopics(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<Topic[] | null> {
  const query = db
    .from("topics")
    .select(
      "id, workspace_id, title, description, created_by, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (signal) query.abortSignal(signal);

  const { data, error } = await query.overrideTypes<
    Topic[],
    { merge: false }
  >();
  if (error) throw error;
  return data;
}

export async function createTopic(
  workspaceId: string,
  input: TopicInput,
): Promise<string | null> {
  const { data, error } = await db
    .rpc("create_topic", {
      p_workspace_id: workspaceId,
      p_title: input.title,
      p_description: input.description ?? null,
    });

  if (error) throw error;
  if (typeof data !== "string") return null;
  return data;
}

// Replaces both editable fields; an omitted description clears it.
export async function updateTopic(
  topicId: string,
  input: TopicInput,
): Promise<void> {
  const { error } = await db.rpc("update_topic", {
    p_topic_id: topicId,
    p_title: input.title,
    p_description: input.description ?? null,
  });

  if (error) throw error;
}
