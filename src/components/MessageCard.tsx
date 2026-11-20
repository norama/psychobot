import type { TopicMessage } from '@/db/topicMessages'
import { useTranslation } from 'react-i18next'

type MessageCardProps = {
  message: TopicMessage
  isOwn: boolean
  selected: boolean
  onSelect: () => void
}

export function MessageCard({ message, isOwn, selected, onSelect }: MessageCardProps) {
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
    <button
      type='button'
      aria-pressed={selected}
      onClick={() => {
        if (window.getSelection()?.toString()) return
        if (!selected) onSelect()
      }}
      className={`block w-full max-w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:max-w-[85%] ${
        isOwn ? 'ml-auto' : 'mr-auto'
      } ${
        selected
          ? 'border-brand-700 bg-brand-100 ring-1 ring-brand-700'
          : isOwn
            ? 'border-brand-200 bg-brand-50 hover:border-brand-500 hover:bg-brand-100'
            : 'border-brand-300 bg-white hover:border-brand-500 hover:bg-brand-50'
      }`}>
      <span className='mb-2 block text-xs font-medium text-brand-700'>
        {t(`messages.status.${statusKey}`)}
      </span>

      {message.title && <span className='block break-words font-semibold'>{message.title}</span>}

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
  )
}
