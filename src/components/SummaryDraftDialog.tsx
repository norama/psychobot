import type { TopicMessage, TopicMessageInput } from '@/db/topicMessages'
import { Dialog } from '@/ui/Dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PreparationEntryComposer } from './PreparationEntryComposer'

type SummaryDraftDialogProps = {
  sources: TopicMessage[]
  onSave: (input: TopicMessageInput) => Promise<void>
  onCancel: () => Promise<void>
}

export function SummaryDraftDialog({ sources, onSave, onCancel }: SummaryDraftDialogProps) {
  const { t } = useTranslation()
  const [composerState, setComposerState] = useState({
    dirty: false,
    saving: false,
  })
  const [cancelling, setCancelling] = useState(false)
  const [cancelFailed, setCancelFailed] = useState(false)

  const [initialValue] = useState(() => {
    const titles = sources.map((message) => message.title?.trim() || t('messages.untitled'))

    return {
      title: t('messages.summaryDefaultTitle', {
        titles: titles.join(', '),
      }),
      content: sources
        .map((message, index) => `${titles[index]}\n\n${message.content}`)
        .join('\n\n──────────\n\n'),
    }
  })

  const busy = composerState.saving || cancelling

  async function handleCancel() {
    if (busy) return

    setCancelling(true)
    setCancelFailed(false)

    try {
      await onCancel()
    } catch (error) {
      console.error('Failed to cancel summary', error)
      setCancelFailed(true)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Dialog
      title={t('messages.editSummary')}
      dismissible={!busy}
      onClose={() => void handleCancel()}>
      <p className='text-sm text-brand-700'>
        {t('messages.summaryDraftHint', { count: sources.length })}
      </p>

      <fieldset disabled={cancelling}>
        <PreparationEntryComposer
          initialValue={initialValue}
          onSave={onSave}
          onStateChange={setComposerState}
        />
      </fieldset>
    </Dialog>
  )
}
