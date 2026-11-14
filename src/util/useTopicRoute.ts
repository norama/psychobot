import { useLocation, useNavigate } from "react-router";

export function useTopicRoute() {
    const location = useLocation();
    const navigate = useNavigate();
    const topicId = new URLSearchParams(location.search).get("topic");

    function chooseTopic(nextTopicId: string) {
        const params = new URLSearchParams(location.search);
        params.set("topic", nextTopicId);

        navigate({
            pathname: location.pathname,
            search: `?${params.toString()}`,
            hash: location.hash,
        });
    }

    return { topicId, chooseTopic };
}
