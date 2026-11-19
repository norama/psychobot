import type { SummarySource } from "@/db/summarySources";
import type { TopicMessage } from "@/db/topicMessages";

export type MessageTree = {
    messagesById: Map<string, TopicMessage>;
    childrenById: Map<string, string[]>;
    parentById: Map<string, string>;
    rootIds: string[];
};

// Input messages are already in the desired root display order.
// Returns null when the relationships cannot form a tree.
export function buildMessageTree(
    messages: TopicMessage[],
    sources: SummarySource[],
): MessageTree | null {
    const messagesById = new Map(
        messages.map((message) => [message.id, message]),
    );

    if (messagesById.size !== messages.length) return null;

    const childrenById = new Map<string, string[]>(
        messages.map((message) => [message.id, []]),
    );
    const parentById = new Map<string, string>();

    for (const { summary_id, source_id } of sources) {
        if (!messagesById.has(summary_id) || !messagesById.has(source_id)) {
            return null;
        }

        childrenById.get(summary_id)!.push(source_id);
        parentById.set(source_id, summary_id);
    }

    const rootIds = messages
        .filter((message) => !parentById.has(message.id))
        .map((message) => message.id);

    // One visited set detects repeated children.
    // The coverage check also detects disconnected cycles.
    const visited = new Set<string>();
    const pending = [...rootIds];

    while (pending.length > 0) {
        const id = pending.pop()!;

        if (visited.has(id)) return null;

        visited.add(id);
        pending.push(...childrenById.get(id)!);
    }

    if (visited.size !== messagesById.size) return null;

    for (const children of childrenById.values()) {
        children.sort((idA, idB) => {
            const a = messagesById.get(idA)!;
            const b = messagesById.get(idB)!;

            return (
                new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime() ||
                a.id.localeCompare(b.id)
            );
        });
    }

    return { messagesById, childrenById, parentById, rootIds };
}
