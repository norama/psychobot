import { useLocation, useNavigate } from "react-router";

export function useMessageRoute() {
    const location = useLocation();
    const navigate = useNavigate();
    const messageId = new URLSearchParams(location.search).get("message");

    function chooseMessage(
        nextMessageId: string | null,
        { replace = false }: { replace?: boolean } = {},
    ) {
        const params = new URLSearchParams(location.search);

        if (nextMessageId === null) {
            params.delete("message");
        } else {
            params.set("message", nextMessageId);
        }

        navigate(
            {
                pathname: location.pathname,
                search: params.size ? `?${params.toString()}` : "",
                hash: location.hash,
            },
            { replace },
        );
    }

    return { messageId, chooseMessage };
}
