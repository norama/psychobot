import type { Role } from '@/util/roleRoute'
import { currentRole, storeRole } from '@/util/roleRoute'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from './supabase'

const authResponse = new URL(window.location.href)
const callbackError =
  authResponse.searchParams.has('error') ||
  new URLSearchParams(authResponse.hash.slice(1)).has('error')
const callbackCode = authResponse.searchParams.has('code')

function useRole() {
  const [role, setRole] = useState<Role>(currentRole)

  function chooseRole(next: Role) {
    storeRole(next)
    window.history.replaceState(null, '', `/${next}${window.location.search}`)
    setRole(next)
  }

  return { role, chooseRole }
}

export function useAuth() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { role, chooseRole } = useRole()

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
  return { session, busy, error, signIn, signOut, role, chooseRole }
}
