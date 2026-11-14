import { getTopics, type Topic } from "@/db/topics";
import { useCallback, useEffect, useRef, useState } from "react";

type TopicsState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; topics: Topic[] };

export function useTopics(workspaceId: string) {
    const controllerRef = useRef<AbortController | null>(null);
    const activeWorkspaceRef = useRef<string | null>(null);

    const [result, setResult] = useState<{
        workspaceId: string;
        state: TopicsState;
    }>({
        workspaceId,
        state: { status: "loading" },
    });

    const reload = useCallback(async () => {
        if (activeWorkspaceRef.current !== workspaceId) return;

        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setResult({ workspaceId, state: { status: "loading" } });

        try {
            const topics = await getTopics(workspaceId, controller.signal);
            if (controller.signal.aborted) return;

            setResult({
                workspaceId,
                state: topics === null
                    ? { status: "error" }
                    : { status: "ready", topics },
            });
        } catch {
            if (!controller.signal.aborted) {
                setResult({ workspaceId, state: { status: "error" } });
            }
        }
    }, [workspaceId]);

    useEffect(() => {
        activeWorkspaceRef.current = workspaceId;
        void reload();

        return () => {
            activeWorkspaceRef.current = null;
            controllerRef.current?.abort();
        };
    }, [workspaceId, reload]);

    const state: TopicsState = result.workspaceId === workspaceId
        ? result.state
        : { status: "loading" };

    return { state, reload };
}
