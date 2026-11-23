import type { TopicMessage } from "@/db/topicMessages";
import { markTopicMessageRead } from "@/db/topicMessages";
import { useEffect } from "react";

export function useMessageRead(
    message: TopicMessage | null | undefined,
    userId: string,
    onRead: (messageId: string, readAt: string) => void,
) {
    const messageId = message?.id;
    const authorId = message?.created_by;
    const status = message?.status;
    const readAt = message?.read_at;

    useEffect(() => {
        if (
            !messageId ||
            !userId ||
            authorId === userId ||
            status !== "shared" ||
            readAt !== null
        ) {
            return;
        }

        let cancelled = false;
        let inFlight = false;
        let completed = false;
        let frame: number | null = null;

        async function markRead() {
            if (
                cancelled ||
                inFlight ||
                completed ||
                document.visibilityState !== "visible"
            ) {
                return;
            }

            inFlight = true;

            try {
                const timestamp = await markTopicMessageRead(messageId!);

                if (!cancelled) {
                    completed = true;
                    onRead(messageId!, timestamp);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to record message display", error);
                }
            } finally {
                inFlight = false;
            }
        }

        function scheduleMarkRead() {
            if (frame !== null) {
                cancelAnimationFrame(frame);
                frame = null;
            }

            if (document.visibilityState === "visible") {
                frame = requestAnimationFrame(() => {
                    frame = null;
                    void markRead();
                });
            }
        }

        document.addEventListener("visibilitychange", scheduleMarkRead);
        scheduleMarkRead();

        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", scheduleMarkRead);

            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, [messageId, authorId, status, readAt, userId, onRead]);
}
