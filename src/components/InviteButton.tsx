import { testEmailFunction } from '@/db/emailTest'
import { Button } from '@/ui/Button'
import { t } from 'i18next'
import { useState } from 'react'

export function InviteButton() {
  const [testingFunction, setTestingFunction] = useState(false)

  async function handleTestFunction() {
    setTestingFunction(true)

    try {
      const message = await testEmailFunction()
      window.alert(message)
    } catch (error) {
      console.error('Edge Function test failed:', error)
      window.alert(t('connections.functionTestFailed'))
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
