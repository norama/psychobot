import { createInvitation } from '@/db/invitations'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function InviteButton() {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [result, setResult] = useState<{
    message: string
    url: string
  } | null>(null)

  function handleOpen() {
    setRecipient('')
    setFailed(false)
    setResult(null)
    setOpen(true)
  }

  async function handleCreate() {
    if (saving || !recipient.trim()) return

    setSaving(true)
    setFailed(false)

    try {
      const invitation = await createInvitation(recipient.trim())
      if (!invitation?.invitationUrl) {
        throw new Error('Missing invitation URL')
      }

      setResult({
        message: invitation.message,
        url: invitation.invitationUrl,
      })
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'mt-1 block w-full rounded-lg border border-brand-300 bg-white px-3 py-2'

  return (
    <>
      <Button variant='secondary' onClick={handleOpen}>
        {t('connections.inviteClient')}
      </Button>

      {open && (
        <Dialog
          title={t('connections.inviteClient')}
          onClose={() => setOpen(false)}
          dismissible={!saving}>
          {result ? (
            <div className='space-y-4'>
              <p role='status'>{result.message || t('connections.invitationCreated')}</p>

              <div>
                <label htmlFor={`${id}-link`} className='font-medium'>
                  {t('connections.invitationLink')}
                </label>
                <input
                  id={`${id}-link`}
                  readOnly
                  value={result.url}
                  onFocus={(event) => event.currentTarget.select()}
                  className={fieldClass}
                />
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreate()
              }}>
              <fieldset disabled={saving} className='space-y-4'>
                <div>
                  <label htmlFor={`${id}-email`} className='font-medium'>
                    {t('connections.recipientEmail')}
                  </label>
                  <input
                    id={`${id}-email`}
                    type='email'
                    autoComplete='email'
                    autoFocus
                    required
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    className={fieldClass}
                  />
                </div>

                {failed && <p role='alert'>{t('connections.invitationFailed')}</p>}

                <div className='flex justify-end'>
                  <Button type='submit' disabled={saving}>
                    {t(saving ? 'connections.creatingInvitation' : 'connections.createInvitation')}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
        </Dialog>
      )}
    </>
  )
}
