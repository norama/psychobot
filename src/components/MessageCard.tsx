import type { TopicMessage, TopicMessageInput } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { SummaryIcon } from '@/ui/SummaryIcon'
import { useTranslation } from 'react-i18next'
import { PreparationEntryComposer } from './PreparationEntryComposer'

type MessageCardProps = {
  message: TopicMessage
  isOwn: boolean
  isSummary: boolean
  selected: boolean
  onSelect: () => void
  editing: boolean
  editDisabled: boolean
  isSource: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (input: TopicMessageInput) => Promise<void>
  onEditorStateChange: (state: { dirty: boolean; saving: boolean }) => void
}

export function MessageCard({
  message,
  isOwn,
  isSummary,
  selected,
  onSelect,
  editing,
  editDisabled,
  isSource,
  onEdit,
  onCancel,
  onSave,
  onEditorStateChange,
}: MessageCardProps) {
  const { t, i18n } = useTranslation()
  const displayDate = message.shared_at ?? message.created_at
  const collapsed = !isOwn && !selected

  const statusKey = !isOwn
    ? 'received'
    : message.status === 'shared'
      ? 'sent'
      : message.status === 'final'
        ? 'final'
        : 'draft'

  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <div
      className={`w-full max-w-full rounded-2xl border transition-colors md:max-w-[85%] ${
        isOwn ? 'ml-auto' : 'mr-auto'
      } ${
        selected
          ? 'border-brand-700 bg-brand-100 ring-1 ring-brand-700'
          : isOwn
            ? 'border-brand-200 bg-brand-50 hover:border-brand-500 hover:bg-brand-100'
            : 'border-brand-300 bg-white hover:border-brand-500 hover:bg-brand-50'
      }`}>
      {editing ? (
        <div className='px-4 pb-4'>
          {isSummary && (
            <p className='pt-3 text-sm text-brand-700'>{t('messages.editSummaryHint')}</p>
          )}

          {isSource && (
            <p className='pt-3 text-sm text-brand-700'>{t('messages.editSourceHint')}</p>
          )}

          <PreparationEntryComposer
            initialValue={{ title: message.title, content: message.content }}
            onSave={onSave}
            onCancel={onCancel}
            onStateChange={onEditorStateChange}
            mode='edit'
          />
        </div>
      ) : (
        <button
          type='button'
          aria-pressed={selected}
          onClick={() => {
            if (window.getSelection()?.toString()) return
            if (!selected) onSelect()
          }}
          className='block w-full cursor-pointer rounded-2xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700'>
          <span className='mb-2 flex items-center gap-2 text-xs font-medium text-brand-700'>
            {isSummary && (
              <>
                <SummaryIcon />
                <span className='sr-only'>{t('messages.summary')}</span>
              </>
            )}
            {t(`messages.status.${statusKey}`)}
          </span>

          {message.title && (
            <span className='block break-words font-semibold'>{message.title}</span>
          )}

          <span
            className={
              collapsed ? 'line-clamp-2 break-words' : 'block whitespace-pre-wrap break-words'
            }>
            {message.content}
          </span>

          <time dateTime={displayDate} className='mt-2 block text-xs text-brand-700'>
            {dateFormatter.format(new Date(displayDate))}
          </time>
        </button>
      )}
      {selected && isOwn && message.status === 'draft' && !editing && (
        <div className='flex justify-end px-4 pb-3'>
          <Button
            type='button'
            variant='secondary'
            className='inline-flex items-center p-2'
            title={t('messages.edit')}
            aria-label={t('messages.edit')}
            disabled={editDisabled}
            onClick={onEdit}>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              strokeLinecap='round'
              strokeLinejoin='round'
              aria-hidden='true'
              className='h-4 w-4'>
              <path d='m16 3 5 5-12 12-6 1 1-6L16 3Z' />
              <path d='m14 5 5 5' />
            </svg>
          </Button>
        </div>
      )}
    </div>
  )
}
