import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
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
import { useAppRoute } from './util/useAppRoute'
import { getStoredRole, type Role } from './util/roleRoute'
import { getStoredWorkspace } from './util/workspaceData'
import { hasOAuthCallback, withoutOAuthCallback } from './util/oauthCallback'

type AppRouteProps = { role: Role; isInvitationRoute?: boolean }

function AuthenticatedApp({ role, isInvitationRoute = false }: AppRouteProps) {
  const { t } = useTranslation()
  const { chooseRole, workspaceId, invitationToken, location, navigate } = useAppRoute(role, isInvitationRoute)
  const [callbackExpected] = useState(() => hasOAuthCallback(location))
  const { session, initialized, busy, error, signIn, signOut } = useAuth(callbackExpected)
  const callbackHandled = useRef(false)
  const [unavailableWorkspace, setUnavailableWorkspace] = useState<string | null>(null)
  const workspaceKey = session && workspaceId !== null ? `${session.user.id}:${workspaceId}` : null
  const handleWorkspaceUnavailable = useCallback((unavailable: boolean) => {
    setUnavailableWorkspace(unavailable ? workspaceKey : null)
  }, [workspaceKey])

  useEffect(() => {
    if (!initialized || session === undefined || callbackHandled.current) return
    callbackHandled.current = true
    const clean = withoutOAuthCallback(location)
    // Supabase may already have removed code through history.replaceState;
    // navigating also synchronizes React Router's location with the browser.
    if (clean.search !== location.search || clean.hash !== location.hash) {
      navigate({ pathname: location.pathname, ...clean }, { replace: true })
    }
  }, [initialized, session, location, navigate])

  function handleSignIn() {
    const clean = withoutOAuthCallback(location)
    void signIn(window.location.origin + location.pathname + clean.search)
  }

  async function handleSignOut() {
    // Keep an unavailable link for account switching; ordinary logout returns
    // to the overview. Scope the result to the current account and workspace.
    const keepDestination = isInvitationRoute ||
      (workspaceKey !== null && unavailableWorkspace === workspaceKey)
    const signedOut = await signOut()
    if (signedOut && !keepDestination) navigate(`/${role}`, { replace: true })
  }

  const themes = useThemeCatalog()

  // LoggedInScreen owns theming, but only while it's actually mounted (signed
  // in with a specific workspace in the URL). Signed out always wins here,
  // regardless of the URL, since LoggedInScreen never renders in that case —
  // otherwise signing out while viewing a workspace left its theme stuck.
  // The invitation route gets its own fixed theme; it must be decided here
  // (not in InviteScreen) because this effect runs after the child's.
  useFixedTheme(
    themes,
    !session
      ? 'signed_out'
      : isInvitationRoute
        ? 'invitation'
        : workspaceId === null
          ? 'signed_in'
          : null,
  )

  if (!initialized || session === undefined)
    return (
      <Layout>
        <p role='status'>{t('auth.checking')}</p>
      </Layout>
    )

  return (
    <Layout
      roleLabel={session ? t(`connections.roles.${role}`) : undefined}
      narrow={!session || workspaceId === null}
      actions={
        session && (
          <UserMenu db={db} userId={session.user.id} role={role} busy={busy} onSignOut={handleSignOut} />
        )
      }>
      {error && <p role='alert'>{error}</p>}
      {session ? (
        isInvitationRoute ? (
          <InviteScreen
            key={`${session.user.id}:${session.user.email ?? ''}:${invitationToken}`}
            token={invitationToken}
            userEmail={session.user.email ?? ''}
          />
        ) : (
          <LoggedInScreen
            key={`${session.user.id}:${role}:${workspaceId}`}
            userId={session.user.id}
            role={role}
            workspaceId={workspaceId}
            onWorkspaceUnavailable={handleWorkspaceUnavailable}
            themes={themes}
          />
        )
      ) : (
        <LoggedOutScreen
          role={role}
          busy={busy}
          isInvitationRoute={isInvitationRoute}
          onChooseRole={chooseRole}
          onSignIn={handleSignIn}
        />
      )}
    </Layout>
  )
}

function App(props: AppRouteProps) {
  const { t } = useTranslation()
  if (supabase) return <AuthenticatedApp {...props} />
  return (
    <Layout>
      <h1>{t('setup.title')}</h1>
      <p>
        <Trans i18nKey='setup.text' components={{ code: <code /> }} />
      </p>
    </Layout>
  )
}

function RememberedDestination({ restoreWorkspace = false }: { restoreWorkspace?: boolean }) {
  const { search, hash } = useLocation()
  // Only the root route with no search restores a workspace. Explicit links
  // and unknown paths retain their query parameters and use the remembered role.
  const workspace = restoreWorkspace && !search ? getStoredWorkspace() : null
  const destination = workspace
    ? `/${workspace.role}?workspace=${workspace.id}`
    : `/${getStoredRole() ?? 'client'}${search}`
  return <Navigate to={destination + hash} replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<RememberedDestination restoreWorkspace />} />
        <Route path='/client' caseSensitive element={<App role='client' />} />
        <Route path='/therapist' caseSensitive element={<App role='therapist' />} />
        <Route path='/invite' caseSensitive element={<App role='client' isInvitationRoute />} />
        <Route path='*' element={<RememberedDestination />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
