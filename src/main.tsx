import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Trans, useTranslation } from 'react-i18next'
import { useAuth } from './db/auth'
import { db, supabase } from './db/supabase'
import { useFixedTheme, useThemeCatalog } from './db/theme'
import './i18n'
import { InviteScreen } from './screens/InviteScreen'
import { LoggedInScreen } from './screens/LoggedInScreen'
import { LoggedOutScreen } from './screens/LoggedOutScreen'
import { UserMenu } from './screens/UserMenu'
import './style.css'
import { Layout } from './ui/Layout'
import { getInvitationToken, isInvitationRoute } from './util/roleRoute'
import { getWorkspaceId } from './util/workspaceData'

function AuthenticatedApp() {
  const { t } = useTranslation()
  const { session, busy, error, signIn, signOut, role, chooseRole } = useAuth()
  const themes = useThemeCatalog()

  // LoggedInScreen owns theming, but only while it's actually mounted (signed
  // in with a specific workspace in the URL). Signed out always wins here,
  // regardless of the URL, since LoggedInScreen never renders in that case —
  // otherwise signing out while viewing a workspace left its theme stuck.
  useFixedTheme(themes, !session ? 'signed_out' : getWorkspaceId() === null ? 'signed_in' : null)

  if (session === undefined)
    return (
      <Layout>
        <p role='status'>{t('auth.checking')}</p>
      </Layout>
    )

  return (
    <Layout
      roleLabel={session ? t(`connections.roles.${role}`) : undefined}
      narrow={!session || getWorkspaceId() === null}
      actions={
        session && (
          <UserMenu db={db} userId={session.user.id} role={role} busy={busy} onSignOut={signOut} />
        )
      }>
      {error && <p role='alert'>{error}</p>}
      {session ? (
        isInvitationRoute ? (
          <InviteScreen
            key={`${session.user.id}:${session.user.email ?? ''}`}
            token={getInvitationToken()}
            userEmail={session.user.email ?? ''}
          />
        ) : (
          <LoggedInScreen
            key={session.user.id}
            userId={session.user.id}
            role={role}
            themes={themes}
          />
        )
      ) : (
        <LoggedOutScreen role={role} busy={busy} onChooseRole={chooseRole} onSignIn={signIn} />
      )}
    </Layout>
  )
}

function App() {
  const { t } = useTranslation()
  if (supabase) return <AuthenticatedApp />
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
