function messageKey(userId: string, topicId: string) {
    return `lastMessage:${userId}:${topicId}`;
}

export function getStoredMessage(
    userId: string,
    topicId: string,
): string | null {
    try {
        return localStorage.getItem(messageKey(userId, topicId));
    } catch {
        return null;
    }
}

export function storeMessage(
    userId: string,
    topicId: string,
    messageId: string | null,
) {
    try {
        const key = messageKey(userId, topicId);

        if (messageId === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, messageId);
        }
    } catch {
        // Remembering selection is optional; storage failure must not block editing.
    }
}
