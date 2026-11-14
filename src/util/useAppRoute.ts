import { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { storeRole, type Role } from './roleRoute'

// Route elements supply the role and invitation flag; React Router owns matching.
export function useAppRoute(role: Role, isInvitationRoute: boolean) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!isInvitationRoute) storeRole(role)
  }, [isInvitationRoute, role])

  function chooseRole(next: Role) {
    if (isInvitationRoute) return
    navigate({ pathname: `/${next}`, search: location.search, hash: location.hash }, { replace: true })
  }

  return {
    location, navigate, role, chooseRole, isInvitationRoute,
    workspaceId: searchParams.get('workspace'),
    invitationToken: searchParams.get('token'),
  }
}
