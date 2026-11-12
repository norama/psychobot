import { acceptInvitation, getInvitation, type InvitationDetails } from '@/db/invitations'
import { Button } from '@/ui/Button'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type InviteScreenProps = {
  token: string | null
  userEmail: string
}

type InvitationState =
  | { status: 'loading' }
  | { status: 'ready'; invitation: InvitationDetails }
  | { status: 'error'; message: string }

export function InviteScreen({ token, userEmail }: InviteScreenProps) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<InvitationState>({ status: 'loading' })
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')

  useEffect(() => {
    if (!token) return

    let active = true

    async function load() {
      try {
        const invitation = await getInvitation(token!)
        if (!invitation) {
          throw new Error(t('invitation.loadFailed'))
        }

        if (active) {
          setState({ status: 'ready', invitation })
        }
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : t('invitation.loadFailed'),
          })
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [token, t])

  async function handleAccept() {
    if (!token || accepting || state.status !== 'ready') return

    setAccepting(true)
    setAcceptError('')

    try {
      const workspaceId = await acceptInvitation(token)

      if (!workspaceId) {
        throw new Error(t('invitation.acceptFailed'))
      }

      window.location.assign(`/client?workspace=${encodeURIComponent(workspaceId)}`)
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : t('invitation.acceptFailed'))
      setAccepting(false)
    }
  }

  return (
    <>
      <h1>{t('invitation.title')}</h1>
      <div className='mt-6'>
        <p>{t('invitation.signedInAs', { email: userEmail })}</p>

        {!token ? (
          <p role='alert'>{t('invitation.invalidLink')}</p>
        ) : state.status === 'loading' ? (
          <p role='status'>{t('invitation.loading')}</p>
        ) : state.status === 'error' ? (
          <p role='alert'>{state.message}</p>
        ) : (
          <>
            <p>
              {t('invitation.invitedBy', {
                name: state.invitation.inviterName,
              })}
            </p>
            <p>
              {t('invitation.expiresAt', {
                date: new Date(state.invitation.expiresAt).toLocaleString(
                  i18n.resolvedLanguage ?? 'cs',
                ),
              })}
            </p>
            <Button className='mt-6' disabled={accepting} onClick={handleAccept}>
              {accepting ? t('invitation.accepting') : t('invitation.accept')}
            </Button>
            {acceptError && <p role='alert'>{acceptError}</p>}
          </>
        )}
      </div>
    </>
  )
}
