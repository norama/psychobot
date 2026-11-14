import { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { getStoredRole, storeRole, type Role } from './roleRoute'
import { getStoredWorkspace } from './workspaceData'

export function useAppRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isInvitationRoute = /^\/invite\/?$/.test(location.pathname)
  const match = /^\/(therapist|client)\/?$/.exec(location.pathname)
  const isRoleRoute = match !== null
  const role: Role = match ? (match[1] as Role) : 'client'

  useEffect(() => {
    if (isRoleRoute) storeRole(role)
  }, [isRoleRoute, role])

  // Only a plain root visit restores a workspace; explicit URLs always win.
  let fallback: string | null = null
  if (!match && !isInvitationRoute) {
    const workspace = location.pathname === '/' && !location.search
      ? getStoredWorkspace()
      : null
    fallback = workspace
      ? `/${workspace.role}?workspace=${workspace.id}`
      : `/${getStoredRole() ?? 'client'}${location.search}`
    fallback += location.hash
  }

  function chooseRole(next: Role) {
    if (isInvitationRoute) return
    navigate({ pathname: `/${next}`, search: location.search, hash: location.hash }, { replace: true })
  }

  return {
    location, navigate, role, chooseRole, isInvitationRoute, fallback,
    workspaceId: searchParams.get('workspace'),
    invitationToken: searchParams.get('token'),
  }
}
