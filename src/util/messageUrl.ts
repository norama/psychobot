export function getMessageUrl(messageId: string): string {
    return new URL(
        `/message/${encodeURIComponent(messageId)}`,
        window.location.origin,
    ).href;
}
