import {
    getTopicMessageReadReceipts,
    type MessageReadReceipt,
} from "@/db/topicMessages";
import { useEffect } from "react";

export function useMessageReadReceipts(
    topicId: string | null,
    userId: string,
    onRefresh: (receipts: MessageReadReceipt[]) => void,
) {
    useEffect(() => {
        if (topicId === null || !userId) return;

        const currentTopicId = topicId;
        let controller: AbortController | null = null;

        async function refresh(signal: AbortSignal) {
            try {
                const receipts = await getTopicMessageReadReceipts(
                    currentTopicId,
                    signal,
                );

                if (signal.aborted) return;
                if (receipts === null) {
                    throw new Error("Missing message read receipts");
                }

                onRefresh(receipts);
            } catch (error) {
                if (!signal.aborted) {
                    console.error(
                        "Failed to refresh message read receipts",
                        error,
                    );
                }
            }
        }

        function refreshWhenVisible() {
            if (document.visibilityState !== "visible") return;

            controller?.abort();
            controller = new AbortController();
            void refresh(controller.signal);
        }

        document.addEventListener("visibilitychange", refreshWhenVisible);
        refreshWhenVisible();

        return () => {
            document.removeEventListener(
                "visibilitychange",
                refreshWhenVisible,
            );
            controller?.abort();
        };
    }, [topicId, userId, onRefresh]);
}
