import type { TopicMessage } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type DeleteMessageDialogProps = {
  message: TopicMessage
  isSummary: boolean
  isSource: boolean
  onDelete: () => Promise<void>
  onClose: () => void
}

export function DeleteMessageDialog({
  message,
  isSummary,
  isSource,
  onDelete,
  onClose,
}: DeleteMessageDialogProps) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleDelete() {
    if (deleting) return

    setDeleting(true)
    setFailed(false)

    try {
      await onDelete()
      onClose()
    } catch (error) {
      console.error('Failed to delete message', error)
      setFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      title={t('messages.deleteTitle')}
      onClose={onClose}
      dismissible={!deleting}
      showCloseButton={false}>
      {message.title && <p className='mb-3 break-words font-semibold'>{message.title}</p>}

      <p>{t('messages.deleteHint')}</p>

      {isSummary && (
        <p className='mt-3 text-sm text-brand-700'>{t('messages.deleteSummaryHint')}</p>
      )}

      {isSource && <p className='mt-3 text-sm text-brand-700'>{t('messages.deleteSourceHint')}</p>}

      {failed && (
        <p role='alert' className='mt-3 text-sm'>
          {t('messages.deleteFailed')}
        </p>
      )}

      <div className='mt-6 flex justify-end gap-2'>
        <Button type='button' variant='secondary' disabled={deleting} onClick={onClose}>
          {t('messages.cancel')}
        </Button>

        <Button type='button' disabled={deleting} onClick={() => void handleDelete()}>
          {t(deleting ? 'messages.deleting' : 'messages.delete')}
        </Button>
      </div>
    </Dialog>
  )
}
