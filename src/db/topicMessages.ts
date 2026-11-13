import { db } from "./supabase";
import { handleError } from "./util";

export type TopicMessageType = "entry" | "summary" | "message";
export type TopicMessageStatus = "draft" | "final" | "shared";

export type TopicMessage = {
  id: string;
  topic_id: string;
  preparation_id: string;
  title: string | null;
  content: string;
  type: TopicMessageType;
  status: TopicMessageStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_at: string | null;
};

export type TopicMessageInput = {
  content: string;
  title?: string | null;
};

export type CreateTopicMessageInput = TopicMessageInput & {
  preparationId: string;
  type: TopicMessageType;
};

// RLS returns the caller's private content and either participant's shared messages.
export async function getTopicMessages(
  topicId: string,
  signal?: AbortSignal,
): Promise<TopicMessage[] | null> {
  const query = db
    .from("topic_messages")
    .select(
      "id, topic_id, preparation_id, title, content, type, status, created_by, created_at, updated_at, shared_at",
    )
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (signal) query.abortSignal(signal);

  const { data, error } = await query.overrideTypes<
    TopicMessage[],
    { merge: false }
  >();
  if (error) throw error;
  return data;
}

// The database sets the author and creates a private draft.
export async function createTopicMessage(
  topicId: string,
  input: CreateTopicMessageInput,
): Promise<string | null> {
  const { data, error } = await db.rpc("create_topic_message", {
    p_topic_id: topicId,
    p_preparation_id: input.preparationId,
    p_type: input.type,
    p_content: input.content,
    p_title: input.title ?? null,
  });

  if (error) throw error;
  if (typeof data !== "string") return null;
  return data;
}

// Replaces both editable fields; an omitted title clears it.
export async function updateTopicMessage(
  messageId: string,
  input: TopicMessageInput,
): Promise<void> {
  const { error } = await db.rpc("update_topic_message", {
    p_message_id: messageId,
    p_content: input.content,
    p_title: input.title ?? null,
  });

  if (error) throw error;
}

export async function deleteTopicMessage(messageId: string): Promise<void> {
  const { error } = await db.rpc("delete_topic_message", {
    p_message_id: messageId,
  });

  if (error) throw error;
}

type ShareTopicMessageResult = {
  shared: boolean;
  emailSubmitted?: boolean;
  message?: string;
};

export async function shareTopicMessage(
  messageId: string,
): Promise<ShareTopicMessageResult | null> {
  const { data, error } = await db.functions.invoke<ShareTopicMessageResult>(
    "send-topic-message",
    { body: { message_id: messageId } },
  );

  if (error) {
    await handleError(error);
    return null;
  }

  return data;
}
