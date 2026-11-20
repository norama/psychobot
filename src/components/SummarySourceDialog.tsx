import type { TopicMessage } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type SummarySourceDialogProps = {
  candidates: TopicMessage[]
  onClose: () => void
  onSelected: (sourceIds: string[]) => void
}

export function SummarySourceDialog({ candidates, onClose, onSelected }: SummarySourceDialogProps) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const selectedCandidates = candidates.filter((message) => selectedIds.has(message.id))

  function toggle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog title={t('messages.summarySourcesTitle')} onClose={onClose}>
      <p className='text-sm text-brand-700'>{t('messages.summarySourcesHint')}</p>

      {candidates.length === 0 ? (
        <p className='mt-4'>{t('messages.noSummaryCandidates')}</p>
      ) : (
        <>
          <div className='mt-4 flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setSelectedIds(new Set(candidates.map((message) => message.id)))}>
              {t('messages.selectAllSources')}
            </Button>

            <Button type='button' variant='secondary' onClick={() => setSelectedIds(new Set())}>
              {t('messages.clearSources')}
            </Button>
          </div>

          <ul className='mt-4 space-y-2'>
            {candidates.map((message) => (
              <li key={message.id}>
                <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-brand-200 p-3 hover:bg-brand-50'>
                  <input
                    type='checkbox'
                    checked={selectedIds.has(message.id)}
                    onChange={() => toggle(message.id)}
                    className='mt-1 h-4 w-4 shrink-0 accent-brand-700'
                  />

                  <span className='min-w-0'>
                    <span className='block break-words font-medium'>
                      {message.title || t('messages.untitled')}
                    </span>
                    <span className='line-clamp-2 break-words text-sm text-brand-700'>
                      {message.content}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className='mt-6 flex items-center justify-between gap-3'>
        <p role='status' className='text-sm text-brand-700'>
          {t('messages.selectedSourcesCount', {
            count: selectedCandidates.length,
          })}
        </p>

        <Button
          type='button'
          disabled={selectedCandidates.length === 0}
          onClick={() => onSelected(selectedCandidates.map((message) => message.id))}>
          {t('messages.useSources')}
        </Button>
      </div>
    </Dialog>
  )
}
