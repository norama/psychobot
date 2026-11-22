import type { TopicMessage } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { CopyLinkIcon } from '@/ui/icons/CopyLinkIcon'
import { getMessageUrl } from '@/util/messageUrl'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type CopyMessageLinkButtonProps = {
  message: TopicMessage
  variant?: 'secondary' | 'quiet'
}

export function CopyMessageLinkButton({
  message,
  variant = 'secondary',
}: CopyMessageLinkButtonProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')

  async function copyLink() {
    if (status === 'copying') return

    setStatus('copying')

    const url = getMessageUrl(message.id)
    const label = message.title?.trim() || new URL(url).pathname

    // Escape Markdown formatting characters in the title.
    const escapedLabel = ['\\', '`', '*', '_', '[', ']', '<', '>', '~'].reduce(
      (text, character) => text.replaceAll(character, `\\${character}`),
      label.replaceAll('\r', ' ').replaceAll('\n', ' '),
    )

    try {
      await navigator.clipboard.writeText(`[${escapedLabel}](${url})`)
      setStatus('copied')

      window.setTimeout(() => setStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy message link', error)
      setStatus('error')
    }
  }

  const feedback =
    status === 'copied'
      ? t('messages.linkCopied')
      : status === 'error'
        ? t('messages.copyLinkFailed')
        : null

  return (
    <div className='relative inline-flex'>
      <Button
        type='button'
        variant={variant}
        className='inline-flex h-10 w-10 items-center justify-center p-2'
        title={t('messages.copyLink')}
        aria-label={t('messages.copyLink')}
        disabled={status === 'copying'}
        onClick={() => void copyLink()}
        onBlur={() => {
          if (status !== 'copying') setStatus('idle')
        }}>
        <CopyLinkIcon />
      </Button>

      {feedback && (
        <span
          role={status === 'error' ? 'alert' : 'status'}
          className='absolute right-0 bottom-full z-10 mb-2 w-max max-w-64 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm shadow-sm'>
          {feedback}
        </span>
      )}
    </div>
  )
}
