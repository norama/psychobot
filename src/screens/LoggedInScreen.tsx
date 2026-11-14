import { InviteButton } from '@/components/InviteButton'
import type { ThemeRole } from '@/db/theme'
import { useFixedTheme, useThemeCatalog, useWorkspaceTheme } from '@/db/theme'
import { useWorkspaces } from '@/db/workspaces'
import { ClientWorkspace } from '@/screens/ClientWorkspace'
import { TherapistWorkspace } from '@/screens/TherapistWorkspace'
import { ConnectionCard } from '@/ui/ConnectionCard'
import { ConnectionSection } from '@/ui/ConnectionSection'
import type { Role } from '@/util/roleRoute'
import { clearStoredWorkspace, storeWorkspace } from '@/util/workspaceData'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

type LoggedInScreenProps = {
  userId: string
  role: Role
  workspaceId: string | null
  onWorkspaceUnavailable: (unavailable: boolean) => void
  themes: ReturnType<typeof useThemeCatalog>
}

export function LoggedInScreen({
  userId, role, workspaceId, themes, onWorkspaceUnavailable,
}: LoggedInScreenProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { state, singleWorkspace } = useWorkspaces(userId, role, workspaceId)

  useEffect(() => {
    onWorkspaceUnavailable(
      state.status === 'ready' && workspaceId !== null && state.rows.length === 0,
    )
  }, [state, workspaceId, onWorkspaceUnavailable])

  const themeRole: ThemeRole = singleWorkspace?.therapist_id === userId ? 'therapist' : 'client'
  const { themeId, choose } = useWorkspaceTheme(
    themes,
    userId,
    singleWorkspace?.id ?? '',
    themeRole,
  )
  // No valid single workspace to open (loading, missing, or inaccessible):
  // fall back to the same theme as the rest of the signed-in app.
  useFixedTheme(themes, workspaceId !== null && !singleWorkspace ? 'signed_in' : null)

  // Remember the opened workspace so / can return to it. An unavailable one
  // is forgotten, so the next visit to / doesn't loop on it.
  useEffect(() => {
    if (state.status !== 'ready' || workspaceId === null) return
    if (state.rows.length === 1) {
      const workspace = state.rows[0]
      storeWorkspace({
        id: workspace.id,
        role: workspace.therapist_id === userId ? 'therapist' : 'client',
      })
    } else if (state.rows.length === 0) {
      clearStoredWorkspace()
    }
  }, [state, workspaceId, userId])

  // The workspace's real role comes from the data. If the URL names the other
  // role (e.g. typed by hand), replace it with the matching path.
  const dataRole: Role | null = singleWorkspace
    ? singleWorkspace.therapist_id === userId
      ? 'therapist'
      : 'client'
    : null
  useEffect(() => {
    if (dataRole === null || dataRole === role || workspaceId === null) return
    navigate({ pathname: `/${dataRole}`, search: location.search, hash: location.hash }, { replace: true })
  }, [dataRole, role, workspaceId, navigate, location.search, location.hash])

  if (state.status === 'loading') return <p role='status'>{t('workspace.loading')}</p>
  if (state.status === 'error') {
    return <p role='alert'>{t('workspace.loadFailed')}</p>
  }
  if (workspaceId === null) {
    return (
      <>
        <h1>{t('connections.overview')}</h1>
        {role === 'therapist' && (
          <ConnectionSection
            title={t('connections.myClients')}
            emptyText={t('connections.noClients')}
            actions={<InviteButton />}>
            {state.rows.map((workspace) => (
              <ConnectionCard
                key={workspace.id}
                counterpartName={workspace.client?.display_name ?? '—'}
                openHref={`/therapist?workspace=${workspace.id}`}
              />
            ))}
          </ConnectionSection>
        )}
        {role === 'client' && (
          <ConnectionSection
            title={t('connections.myTherapists')}
            emptyText={t('connections.noTherapists')}>
            {state.rows.map((workspace) => (
              <ConnectionCard
                key={workspace.id}
                counterpartName={workspace.therapist?.display_name ?? '—'}
                openHref={`/client?workspace=${workspace.id}`}
              />
            ))}
          </ConnectionSection>
        )}
      </>
    )
  }

  if (state.rows.length === 0) {
    return (
      <>
        <h1>{t('workspace.unavailableTitle')}</h1>
        <p>{t('workspace.unavailableText')}</p>
        <Link className='text-brand-700 underline' to={`/${role}`}>
          {t('workspace.backToOverview')}
        </Link>
      </>
    )
  }

  const workspace = state.rows[0]
  const workspaceProps = { workspace, themes, themeId, onChoose: choose }
  return workspace.therapist_id === userId ? (
    <TherapistWorkspace {...workspaceProps} />
  ) : (
    <ClientWorkspace {...workspaceProps} />
  )
}
