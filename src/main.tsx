import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './i18n'
import { Trans, useTranslation } from 'react-i18next'
import { useFixedTheme, useThemeCatalog } from './theme'
import { Layout } from './ui/Layout'
import { LoggedInScreen } from './screens/LoggedInScreen'
import { LoggedOutScreen } from './screens/LoggedOutScreen'
import { UserMenu } from './screens/UserMenu'
import { currentRole, storeRole } from './screens/roleRoute'
import type { Role } from './screens/roleRoute'
import { getWorkspaceId } from './screens/workspaceData'
import './style.css'

const authResponse = new URL(window.location.href)
const callbackError =
  authResponse.searchParams.has('error') ||
  new URLSearchParams(authResponse.hash.slice(1)).has('error')
const callbackCode = authResponse.searchParams.has('code')

function AuthenticatedApp({ db }: { db: SupabaseClient }) {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<Role>(currentRole)
  const themes = useThemeCatalog(db)

  function chooseRole(next: Role) {
    storeRole(next)
    window.history.replaceState(null, '', `/${next}${window.location.search}`)
    setRole(next)
  }
  // LoggedInScreen owns theming, but only while it's actually mounted (signed
  // in with a specific workspace in the URL). Signed out always wins here,
  // regardless of the URL, since LoggedInScreen never renders in that case —
  // otherwise signing out while viewing a workspace left its theme stuck.
  useFixedTheme(themes, !session ? 'signed_out' : getWorkspaceId() === null ? 'signed_in' : null)

  useEffect(() => {
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' && !nextSession && (callbackError || callbackCode)) {
        setError(t('auth.signInFailed'))
        window.history.replaceState(null, '', window.location.pathname)
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
          redirectTo: window.location.origin + window.location.pathname + window.location.search,
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
      window.history.replaceState(null, '', `/${role}`)
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
      roleLabel={session ? t(`connections.roles.${role}`) : undefined}
      actions={
        session && (
          <UserMenu
            db={db}
            userId={session.user.id}
            role={role}
            busy={busy}
            onSignOut={signOut}
          />
        )
      }>
      {error && <p role='alert'>{error}</p>}
      {session ? (
        <LoggedInScreen
          key={session.user.id}
          db={db}
          userId={session.user.id}
          role={role}
          themes={themes}
        />
      ) : (
        <LoggedOutScreen role={role} busy={busy} onChooseRole={chooseRole} onSignIn={signIn} />
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
