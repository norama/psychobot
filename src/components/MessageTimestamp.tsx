import type { TopicMessage } from '@/db/topicMessages'
import { useTranslation } from 'react-i18next'

export function MessageTimestamp({ message }: { message: TopicMessage }) {
  const { i18n } = useTranslation()
  const displayDate = message.shared_at ?? message.created_at

  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <time dateTime={displayDate} className='text-xs text-brand-700'>
      {formatter.format(new Date(displayDate))}
    </time>
  )
}
