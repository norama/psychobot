const topicKey = (workspaceId: string) => `lastTopic:${workspaceId}`;

export function getStoredTopic(workspaceId: string): string | null {
    try {
        return localStorage.getItem(topicKey(workspaceId));
    } catch {
        return null;
    }
}

export function storeTopic(workspaceId: string, topicId: string | null) {
    try {
        const key = topicKey(workspaceId);

        if (topicId === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, topicId);
        }
    } catch {
        // Navigation still works when browser storage is unavailable.
    }
}
