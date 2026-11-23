import type { TopicMessage } from '@/db/topicMessages'
import { ReadIcon } from '@/ui/icons/ReadIcon'
import { useTranslation } from 'react-i18next'

type MessageTimestampProps = {
  message: TopicMessage
  showReadReceipt?: boolean
}

export function MessageTimestamp({ message, showReadReceipt = false }: MessageTimestampProps) {
  const { t, i18n } = useTranslation()
  const displayDate = message.shared_at ?? message.created_at

  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <span className='inline-flex flex-col gap-1 text-xs text-brand-700'>
      <time dateTime={displayDate}>{formatter.format(new Date(displayDate))}</time>

      {showReadReceipt && message.status === 'shared' && message.read_at && (
        <time dateTime={message.read_at} className='inline-flex items-center gap-1.5'>
          <ReadIcon />
          {t('messages.readAt', {
            date: formatter.format(new Date(message.read_at)),
          })}
        </time>
      )}
    </span>
  )
}
