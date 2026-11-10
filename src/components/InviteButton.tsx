import { createInvitation } from '@/db/invitations'
import { Button } from '@/ui/Button'
import { t } from 'i18next'
import { useState } from 'react'

export function InviteButton() {
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false)

  async function handleInviteClient() {
    const recipient = window.prompt(t('connections.recipientEmail'))
    if (!recipient?.trim()) return

    setIsCreatingInvitation(true)

    try {
      const invitation = await createInvitation(recipient)
      if (!invitation || !invitation.invitationUrl) {
        throw new Error(t('connections.invitationFailed'))
      }

      console.log('Invitation created:', invitation)

      window.prompt(invitation.message, invitation.invitationUrl)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('connections.invitationFailed'))
    } finally {
      setIsCreatingInvitation(false)
    }
  }

  return (
    <Button
      variant='secondary'
      disabled={isCreatingInvitation}
      title={t('connections.invitesComingSoon')}
      onClick={handleInviteClient}>
      {t('connections.inviteClient')}
    </Button>
  )
}
