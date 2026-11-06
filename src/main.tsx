import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './i18n'
import { Trans, useTranslation } from 'react-i18next'
import { useFixedTheme, useThemeCatalog, useWorkspaceTheme } from './theme'
import type { ThemeRole } from './theme'
import { Button } from './ui/Button'
import { ConnectionCard } from './ui/ConnectionCard'
import { ConnectionSection } from './ui/ConnectionSection'
import { Layout } from './ui/Layout'
import { ThemeSelector } from './ui/ThemeSelector'
import './style.css'

type Workspace = {
  id: string
  therapist_id: string
  client_id: string
  therapist: { display_name: string } | null
  client: { display_name: string } | null
}

type WorkspacesState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: Workspace[] }

const workspaceId = new URLSearchParams(window.location.search).get('workspace')
const validWorkspaceId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const authResponse = new URL(window.location.href)
const callbackError =
  authResponse.searchParams.has('error') ||
  new URLSearchParams(authResponse.hash.slice(1)).has('error')
const callbackCode = authResponse.searchParams.has('code')

function WorkspaceList({
  db,
  userId,
  themes,
}: {
  db: SupabaseClient
  userId: string
  themes: ReturnType<typeof useThemeCatalog>
}) {
  const { t } = useTranslation()
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
  }, [db])

  const singleWorkspace =
    state.status === 'ready' && workspaceId !== null && state.rows.length === 1
      ? state.rows[0]
      : null
  const role: ThemeRole = singleWorkspace?.therapist_id === userId ? 'therapist' : 'client'
  const { themeId, choose } = useWorkspaceTheme(db, themes, userId, singleWorkspace?.id ?? '', role)
  // No valid single workspace to open (loading, missing, or inaccessible):
  // fall back to the same theme as the rest of the signed-in app.
  useFixedTheme(themes, workspaceId !== null && !singleWorkspace ? 'signed_in' : null)

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
              openHref={`/?workspace=${workspace.id}`}
            />
          ))}
        </ConnectionSection>
        <ConnectionSection
          title={t('connections.myTherapists')}
          emptyText={t('connections.noTherapists')}>
          {asClient.map((workspace) => (
            <ConnectionCard
              key={workspace.id}
              counterpartName={workspace.therapist?.display_name ?? '—'}
              openHref={`/?workspace=${workspace.id}`}
            />
          ))}
        </ConnectionSection>
      </>
    )
  }

  if (state.rows.length === 0) {
    return (
      <>
        <h1>{t('workspace.unavailableTitle')}</h1>
        <p>{t('workspace.unavailableText')}</p>
        <a className='text-brand-700 underline' href='/'>
          {t('workspace.backToOverview')}
        </a>
      </>
    )
  }

  const workspace = state.rows[0]
  const isTherapist = workspace.therapist_id === userId
  return (
    <>
      <h1>{t('workspace.title')}</h1>
      <ConnectionCard
        roleLabel={t(isTherapist ? 'connections.roles.therapist' : 'connections.roles.client')}
        counterpartLabel={t(isTherapist ? 'connections.yourClient' : 'connections.yourTherapist')}
        counterpartName={
          (isTherapist ? workspace.client : workspace.therapist)?.display_name ?? '—'
        }
      />
      {themes && (
        <div className='mt-4'>
          <p className='mb-2 text-sm font-semibold text-brand-700'>{t('theme.groupLabel')}</p>
          <ThemeSelector themes={themes} activeThemeId={themeId} onChoose={choose} />
        </div>
      )}
      <p>{t('workspace.messagesComingSoon')}</p>
    </>
  )
}

function AuthenticatedApp({ db }: { db: SupabaseClient }) {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const themes = useThemeCatalog(db)
  // WorkspaceList owns theming, but only while it's actually mounted (signed
  // in with a specific workspace in the URL). Signed out always wins here,
  // regardless of the URL, since WorkspaceList never renders in that case —
  // otherwise signing out while viewing a workspace left its theme stuck.
  useFixedTheme(themes, !session ? 'signed_out' : workspaceId === null ? 'signed_in' : null)

  useEffect(() => {
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' && !nextSession && (callbackError || callbackCode)) {
        setError(t('auth.signInFailed'))
        window.history.replaceState(null, '', '/')
      }
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [db, t])

  async function signIn() {
    setBusy(true)
    setError('')
    try {
      const { error: signInError } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL('/', window.location.href).href,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (signInError) throw signInError
    } catch {
      setError(t('auth.signInFailed'))
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const { error: signOutError } = await db.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
    } catch {
      setError(t('auth.signOutFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (session === undefined)
    return (
      <Layout>
        <p role='status'>{t('auth.checking')}</p>
      </Layout>
    )

  return (
    <Layout
      actions={
        session && (
          <Button variant='secondary' disabled={busy} onClick={signOut}>
            {t('auth.signOut')}
          </Button>
        )
      }>
      {error && <p role='alert'>{error}</p>}
      {session ? (
        <WorkspaceList key={session.user.id} db={db} userId={session.user.id} themes={themes} />
      ) : (
        <>
          <h1>{t('auth.signedOutTitle')}</h1>
          <p>{t('auth.signedOutText')}</p>
          <Button disabled={busy} onClick={signIn} className='mt-4'>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </>
      )}
    </Layout>
  )
}

function App() {
  const { t } = useTranslation()
  if (supabase) return <AuthenticatedApp db={supabase} />
  return (
    <Layout>
      <h1>{t('setup.title')}</h1>
      <p>
        <Trans i18nKey='setup.text' components={{ code: <code /> }} />
      </p>
    </Layout>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
