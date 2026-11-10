import { testEmailFunction } from '@/db/emailTest'
import { Button } from '@/ui/Button'
import { t } from 'i18next'
import { useState } from 'react'

export function InviteButton() {
  const [testingFunction, setTestingFunction] = useState(false)

  async function handleTestFunction() {
    setTestingFunction(true)

    const email = window.prompt(t('connections.testRecipientEmail'))

    if (!email) {
      setTestingFunction(false)
      return
    }

    try {
      const message = await testEmailFunction(email.trim())
      window.alert(message)
    } catch (error) {
      console.error('Edge Function test failed:', error)
      window.alert(error instanceof Error ? error.message : t('connections.functionTestFailed'))
    } finally {
      setTestingFunction(false)
    }
  }
  return (
    <Button
      variant='secondary'
      disabled={testingFunction}
      title={t('connections.invitesComingSoon')}
      onClick={handleTestFunction}>
      {testingFunction ? t('connections.testingFunction') : t('connections.testFunction')}
    </Button>
  )
}
