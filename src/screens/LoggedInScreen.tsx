import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { useFixedTheme, useThemeCatalog, useWorkspaceTheme } from '@/theme'
import type { ThemeRole } from '@/theme'
import { Button } from '@/ui/Button'
import { ConnectionCard } from '@/ui/ConnectionCard'
import { ConnectionSection } from '@/ui/ConnectionSection'
import { ClientWorkspace } from '@/screens/ClientWorkspace'
import { TherapistWorkspace } from '@/screens/TherapistWorkspace'
import { clearStoredWorkspace, getWorkspaceId, storeWorkspace, validWorkspaceId } from '@/screens/workspaceData'
import type { Workspace, WorkspacesState } from '@/screens/workspaceData'
import type { Role } from '@/screens/roleRoute'

type LoggedInScreenProps = {
  db: SupabaseClient
  userId: string
  role: Role
  themes: ReturnType<typeof useThemeCatalog>
}

export function LoggedInScreen({ db, userId, role, themes }: LoggedInScreenProps) {
  const { t } = useTranslation()
  const workspaceId = getWorkspaceId()
  const [state, setState] = useState<WorkspacesState>({ status: 'loading' })

  useEffect(() => {
    if (workspaceId !== null && !validWorkspaceId.test(workspaceId)) {
      setState({ status: 'ready', rows: [] })
      return
    }

    const controller = new AbortController()
    const query = db.from('workspaces').select(`
        id, therapist_id, client_id,
        therapist:profiles!workspaces_therapist_id_fkey(display_name),
        client:profiles!workspaces_client_id_fkey(display_name)
      `)

    async function load() {
      try {
        const request = workspaceId === null ? query : query.eq('id', workspaceId)
        const { data, error } = await request.abortSignal(controller.signal)
        if (controller.signal.aborted) return
        // supabase-js infers embedded-relation cardinality from the select
        // string without generated Database types, and can't tell a to-one
        // foreign key embed (therapist_id/client_id -> profiles.id) from a
        // to-many one — it defaults to typing both as arrays. PostgREST
        // still returns a single object per row here, so the cast reflects
        // actual runtime shape rather than the generic inferred type.
        setState(
          error ? { status: 'error' } : { status: 'ready', rows: data as unknown as Workspace[] },
        )
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }

    void load()
    return () => controller.abort()
  }, [db, workspaceId])

  const singleWorkspace =
    state.status === 'ready' && workspaceId !== null && state.rows.length === 1
      ? state.rows[0]
      : null
  const themeRole: ThemeRole = singleWorkspace?.therapist_id === userId ? 'therapist' : 'client'
  const { themeId, choose } = useWorkspaceTheme(
    db,
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
  // role (e.g. typed by hand), reload on the matching path instead.
  const dataRole: Role | null = singleWorkspace
    ? singleWorkspace.therapist_id === userId
      ? 'therapist'
      : 'client'
    : null
  useEffect(() => {
    if (dataRole === null || dataRole === role || workspaceId === null) return
    window.location.replace(`/${dataRole}?workspace=${workspaceId}`)
  }, [dataRole, role, workspaceId])

  if (state.status === 'loading') return <p role='status'>{t('workspace.loading')}</p>
  if (state.status === 'error') {
    return <p role='alert'>{t('workspace.loadFailed')}</p>
  }
  if (workspaceId === null) {
    const asTherapist = state.rows.filter((workspace) => workspace.therapist_id === userId)
    const asClient = state.rows.filter((workspace) => workspace.client_id === userId)
    return (
      <>
        <h1>{t('connections.overview')}</h1>
        {role === 'therapist' && (
          <ConnectionSection
            title={t('connections.myClients')}
            emptyText={t('connections.noClients')}
            actions={
              <Button variant='secondary' disabled title={t('connections.invitesComingSoon')}>
                {t('connections.inviteClient')}
              </Button>
            }>
            {asTherapist.map((workspace) => (
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
            {asClient.map((workspace) => (
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
        <a className='text-brand-700 underline' href={`/${role}`}>
          {t('workspace.backToOverview')}
        </a>
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
