import { buttonClassName } from '@/ui/Button'
import { OpenInNewTabIcon } from '@/ui/icons/OpenInNewTabIcon'
import { getMessageUrl } from '@/util/messageUrl'
import { useTranslation } from 'react-i18next'

export function OpenMessageInNewTab({ messageId }: { messageId: string }) {
  const { t } = useTranslation()

  return (
    <a
      href={getMessageUrl(messageId)}
      target='_blank'
      rel='noopener noreferrer'
      title={t('messages.openInNewTab')}
      aria-label={t('messages.openInNewTab')}
      className={buttonClassName(
        'quiet',
        'inline-flex h-10 w-10 shrink-0 items-center justify-center p-2',
      )}>
      <OpenInNewTabIcon />
    </a>
  )
}
