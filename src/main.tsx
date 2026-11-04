import { StrictMode, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './style.css'

type Workspace = {
  id: string
  therapist_id: string
  client_id: string
  therapist_name: string
  client_name: string
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

function Layout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="layout">
      <header className="top">
        <a className="brand" href="/">PsychoBot</a>
        {actions}
      </header>
      <main className="panel">
        <p className="eyebrow">Testovací prostředí</p>
        {children}
      </main>
    </div>
  )
}

function WorkspaceList({ db, userId }: { db: SupabaseClient; userId: string }) {
  const [state, setState] = useState<WorkspacesState>({ status: 'loading' })

  useEffect(() => {
    if (workspaceId !== null && !validWorkspaceId.test(workspaceId)) {
      setState({ status: 'ready', rows: [] })
      return
    }

    const controller = new AbortController()
    const query = db.from('workspaces')
      .select('id, therapist_id, client_id, therapist_name, client_name')

    async function load() {
      try {
        const request = workspaceId === null ? query : query.eq('id', workspaceId)
        const { data, error } = await request.abortSignal(controller.signal)
        if (controller.signal.aborted) return
        setState(error ? { status: 'error' } : { status: 'ready', rows: data })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }

    void load()
    return () => controller.abort()
  }, [db])

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
        <a href="/">Přejít na přehled</a>
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
              <div><dt>Propojený účet</dt><dd>{isTherapist ? workspace.client_name : workspace.therapist_name}</dd></div>
            </dl>
            {workspaceId === null && <a href={`/?workspace=${workspace.id}`}>Otevřít pracovní prostor</a>}
          </section>
        )
      })}
      {workspaceId !== null && <p>Zprávy přidáme v další verzi.</p>}
    </>
  )
}

function AuthenticatedApp({ db }: { db: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    <Layout actions={session && <button className="secondary" disabled={busy} onClick={signOut}>Odhlásit se</button>}>
      {error && <p role="alert">{error}</p>}
      {session ? (
        <WorkspaceList key={session.user.id} db={db} userId={session.user.id} />
      ) : (
        <>
          <h1>Mezi sezeními</h1>
          <p>Přihlaste se testovacím účtem do pracovního prostoru pro klienta a terapeuta.</p>
          <button disabled={busy} onClick={signIn}>
            {busy ? 'Přesměrovávám…' : 'Přihlásit se přes Google'}
          </button>
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
