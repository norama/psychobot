import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { type Role, storeRole } from "./roleRoute";

// Route elements supply the role and invitation flag; React Router owns matching.
export function useAppRoute(role: Role, isInvitationRoute: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!isInvitationRoute) storeRole(role);
  }, [isInvitationRoute, role]);

  function chooseRole(next: Role) {
    if (isInvitationRoute) return;
    navigate({
      pathname: `/${next}`,
      search: location.search,
      hash: location.hash,
    }, { replace: true });
  }

  function chooseTopic(topicId: string) {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("topic", topicId);

    navigate({
      pathname: location.pathname,
      search: `?${nextParams.toString()}`,
      hash: location.hash,
    });
  }

  return {
    location,
    navigate,
    role,
    chooseRole,
    isInvitationRoute,
    workspaceId: searchParams.get("workspace"),
    invitationToken: searchParams.get("token"),
    topicId: searchParams.get("topic"),
    chooseTopic,
  };
}
