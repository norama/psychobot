import type { TopicMessage } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type SendMessageDialogProps = {
  message: TopicMessage
  isSummary: boolean
  onSend: () => Promise<void>
  onClose: () => void
}

export function SendMessageDialog({ message, isSummary, onSend, onClose }: SendMessageDialogProps) {
  const { t } = useTranslation()
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleSend() {
    if (sending) return

    setSending(true)
    setFailed(false)

    try {
      await onSend()
      onClose()
    } catch (error) {
      console.error('Failed to send message', error)
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      title={t('messages.sendTitle')}
      onClose={onClose}
      dismissible={!sending}
      showCloseButton={false}>
      <p className='mb-3 break-words font-semibold'>{message.title || t('messages.untitled')}</p>

      <p>{t('messages.sendHint')}</p>

      {isSummary && <p className='mt-3 text-sm text-brand-700'>{t('messages.sendSourcesHint')}</p>}

      {failed && (
        <p role='alert' className='mt-3 text-sm'>
          {t('messages.sendFailed')}
        </p>
      )}

      <div className='mt-6 flex justify-end gap-2'>
        <Button type='button' variant='secondary' disabled={sending} onClick={onClose}>
          {t('messages.cancel')}
        </Button>

        <Button type='button' disabled={sending} onClick={() => void handleSend()}>
          {t(sending ? 'messages.sending' : 'messages.send')}
        </Button>
      </div>
    </Dialog>
  )
}
