import { db } from "./supabase";
import type { Topic } from "./topics";
import { handleError } from "./util";

export type TopicMessageStatus = "draft" | "final" | "shared";

export type TopicMessage = {
  id: string;
  topic_id: string;
  title: string | null;
  content: string;
  status: TopicMessageStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_at: string | null;
  read_at: string | null;
};

export type TopicMessageInput = {
  content: string;
  title?: string | null;
};

// RLS returns the caller's private content and either participant's shared messages.
export async function getTopicMessages(
  topicId: string,
  signal?: AbortSignal,
): Promise<TopicMessage[] | null> {
  const query = db
    .from("topic_messages")
    .select(
      "id, topic_id, title, content, status, created_by, created_at, updated_at, shared_at, read_at",
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

export async function getTopicMessage(
  topicId: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<TopicMessage | null> {
  const query = db
    .from("topic_messages")
    .select(
      "id, topic_id, title, content, status, created_by, created_at, updated_at, shared_at, read_at",
    )
    .eq("topic_id", topicId)
    .eq("id", messageId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (signal) query.abortSignal(signal);

  const { data, error } = await query.overrideTypes<
    TopicMessage[],
    { merge: false }
  >();
  if (error) throw error;
  return data?.[0] ?? null;
}

export type MessageReadReceipt = Pick<TopicMessage, "id" | "read_at">;

export async function getTopicMessageReadReceipts(
  topicId: string,
  signal?: AbortSignal,
): Promise<MessageReadReceipt[] | null> {
  const query = db
    .from("topic_messages")
    .select("id, read_at")
    .eq("topic_id", topicId)
    .eq("status", "shared");

  if (signal) query.abortSignal(signal);

  const { data, error } = await query.overrideTypes<
    MessageReadReceipt[],
    { merge: false }
  >();

  if (error) throw error;
  return data;
}

export async function getSharedMessage(
  messageId: string,
  signal?: AbortSignal,
): Promise<{ message: TopicMessage; topic: Topic } | null> {
  const messageQuery = db
    .from("topic_messages")
    .select(
      "id, topic_id, title, content, status, created_by, created_at, updated_at, shared_at, read_at",
    )
    .eq("id", messageId)
    .eq("status", "shared");

  if (signal) messageQuery.abortSignal(signal);

  const { data: messages, error: messageError } = await messageQuery
    .overrideTypes<TopicMessage[], { merge: false }>();

  if (messageError) throw messageError;

  const message = messages?.[0];
  if (!message) return null;

  signal?.throwIfAborted();

  const topicQuery = db
    .from("topics")
    .select(
      "id, workspace_id, title, description, created_by, created_at, updated_at",
    )
    .eq("id", message.topic_id);

  if (signal) topicQuery.abortSignal(signal);

  const { data: topics, error: topicError } = await topicQuery.overrideTypes<
    Topic[],
    { merge: false }
  >();

  if (topicError) throw topicError;

  const topic = topics?.[0];
  if (!topic) return null;

  return { message, topic };
}

// The database sets the author and creates a private draft.
export async function createTopicMessage(
  topicId: string,
  input: TopicMessageInput,
): Promise<string | null> {
  const { data, error } = await db.rpc("create_topic_message", {
    p_topic_id: topicId,
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

export async function markTopicMessageRead(
  messageId: string,
): Promise<string> {
  const { data, error } = await db.rpc("mark_topic_message_read", {
    p_message_id: messageId,
  });

  if (error) throw error;

  if (typeof data !== "string") {
    throw new Error("Missing message read timestamp");
  }

  return data;
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
