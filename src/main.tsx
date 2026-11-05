import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useFixedTheme, useThemeCatalog, useWorkspaceTheme } from './theme'
import type { ThemeRole } from './theme'
import { Button } from './ui/Button'
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
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: Workspace[] }

const workspaceId = new URLSearchParams(window.location.search).get('workspace')
const validWorkspaceId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const authResponse = new URL(window.location.href)
const callbackError = authResponse.searchParams.has('error')
  || new URLSearchParams(authResponse.hash.slice(1)).has('error')
const callbackCode = authResponse.searchParams.has('code')

function WorkspaceList({ db, userId, themes }: { db: SupabaseClient; userId: string; themes: ReturnType<typeof useThemeCatalog> }) {
  const [state, setState] = useState<WorkspacesState>({ status: 'loading' })

  useEffect(() => {
    if (workspaceId !== null && !validWorkspaceId.test(workspaceId)) {
      setState({ status: 'ready', rows: [] })
      return
    }

    const controller = new AbortController()
    const query = db.from('workspaces')
      .select(`
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
        setState(error ? { status: 'error' } : { status: 'ready', rows: data as unknown as Workspace[] })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }

    void load()
    return () => controller.abort()
  }, [db])

  const singleWorkspace = state.status === 'ready' && workspaceId !== null && state.rows.length === 1
    ? state.rows[0]
    : null
  const role: ThemeRole = singleWorkspace?.therapist_id === userId ? 'therapist' : 'client'
  const { themeId, choose } = useWorkspaceTheme(db, themes, userId, singleWorkspace?.id ?? '', role)
  // No valid single workspace to open (loading, missing, or inaccessible):
  // fall back to the same theme as the rest of the signed-in app.
  useFixedTheme(themes, workspaceId !== null && !singleWorkspace ? 'signed_in' : null)

  if (state.status === 'loading') return <p role="status">Načítám pracovní prostor…</p>
  if (state.status === 'error') {
    return <p role="alert">Pracovní prostor se nepodařilo načíst. Zkuste obnovit stránku.</p>
  }
  if (state.rows.length === 0) {
    return workspaceId === null ? (
      <>
        <h1>Zatím bez propojení</h1>
        <p>Pro tento účet zatím není vytvořené žádné propojení.</p>
      </>
    ) : (
      <>
        <h1>Pracovní prostor není dostupný</h1>
        <p>Tento odkaz není dostupný pro přihlášený účet.</p>
        <a className="text-brand-700 underline" href="/">Přejít na přehled</a>
      </>
    )
  }

  return (
    <>
      <h1>{workspaceId === null ? 'Přehled propojení' : 'Společný pracovní prostor'}</h1>
      {state.rows.map((workspace) => {
        const isTherapist = workspace.therapist_id === userId
        return (
          <section className="connection" key={workspace.id} aria-label="Propojení">
            <dl>
              <div><dt>Vaše role</dt><dd>{isTherapist ? 'Terapeut' : 'Klient'}</dd></div>
              <div><dt>{isTherapist ? 'Váš klient' : 'Váš terapeut'}</dt><dd>{(isTherapist ? workspace.client : workspace.therapist)?.display_name ?? '—'}</dd></div>
            </dl>
            {workspaceId === null && (
              <a className="mt-4 inline-block text-brand-700 underline" href={`/?workspace=${workspace.id}`}>
                Otevřít pracovní prostor
              </a>
            )}
          </section>
        )
      })}
      {singleWorkspace && themes && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-brand-700">Barevný motiv</p>
          <ThemeSelector themes={themes} activeThemeId={themeId} onChoose={choose} />
        </div>
      )}
      {workspaceId !== null && <p>Zprávy přidáme v další verzi.</p>}
    </>
  )
}

function AuthenticatedApp({ db }: { db: SupabaseClient }) {
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
    const { data: { subscription } } = db.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' && !nextSession && (callbackError || callbackCode)) {
        setError('Přihlášení se nepodařilo. Zkuste to znovu.')
        window.history.replaceState(null, '', '/')
      }
      setSession(nextSession)
    })
    return () => subscription.unsubscribe()
  }, [db])

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
      setError('Přihlášení se nepodařilo. Zkuste to znovu.')
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
      setError('Odhlášení se nepodařilo. Zkuste to znovu.')
    } finally {
      setBusy(false)
    }
  }

  if (session === undefined) return <Layout><p role="status">Ověřuji přihlášení…</p></Layout>

  return (
    <Layout actions={session && <Button variant="secondary" disabled={busy} onClick={signOut}>Odhlásit se</Button>}>
      {error && <p role="alert">{error}</p>}
      {session ? (
        <WorkspaceList key={session.user.id} db={db} userId={session.user.id} themes={themes} />
      ) : (
        <>
          <h1>Mezi sezeními</h1>
          <p>Přihlaste se testovacím účtem do pracovního prostoru pro klienta a terapeuta.</p>
          <Button disabled={busy} onClick={signIn}>
            {busy ? 'Přesměrovávám…' : 'Přihlásit se přes Google'}
          </Button>
        </>
      )}
    </Layout>
  )
}

function App() {
  if (supabase) return <AuthenticatedApp db={supabase} />
  return (
    <Layout>
      <h1>Připojte Supabase</h1>
      <p>V souboru <code>.env.local</code> nastavte adresu projektu a veřejný klíč podle pokynů v README.</p>
    </Layout>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
