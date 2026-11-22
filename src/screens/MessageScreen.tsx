import { getSharedMessage } from '@/db/topicMessages'
import { MarkdownContent } from '@/ui/MarkdownContent'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

type MessageData = NonNullable<Awaited<ReturnType<typeof getSharedMessage>>>

type MessageState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; data: MessageData }

export function MessageScreen() {
  const { t, i18n } = useTranslation()
  const { messageId } = useParams<{ messageId: string }>()
  const [state, setState] = useState<MessageState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setState({ status: 'loading' })

      if (!messageId) {
        setState({ status: 'unavailable' })
        return
      }

      try {
        const data = await getSharedMessage(messageId, controller.signal)
        if (controller.signal.aborted) return

        setState(data ? { status: 'ready', data } : { status: 'unavailable' })
      } catch (error) {
        if (controller.signal.aborted) return

        console.error('Failed to load shared message', error)
        setState({ status: 'error' })
      }
    }

    void load()
    return () => controller.abort()
  }, [messageId])

  if (state.status !== 'ready') {
    return (
      <p role={state.status === 'loading' ? 'status' : 'alert'} className='p-6'>
        {t(
          state.status === 'loading'
            ? 'messages.openingLink'
            : state.status === 'unavailable'
              ? 'messages.messageUnavailable'
              : 'messages.loadFailed',
        )}
      </p>
    )
  }

  const { message, topic } = state.data
  const displayDate = message.shared_at ?? message.created_at
  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <section className='p-4 pt-0'>
      <h1 className='break-words text-xl font-semibold'>{topic.title}</h1>

      {topic.description && (
        <p className='mt-3 whitespace-pre-wrap break-words text-brand-800'>{topic.description}</p>
      )}

      <article className='mt-6 rounded-2xl border border-brand-200 bg-white p-5'>
        {message.title && (
          <h2 className='mb-3 break-words text-lg font-semibold'>{message.title}</h2>
        )}

        <MarkdownContent>{message.content}</MarkdownContent>

        <time dateTime={displayDate} className='mt-4 block text-xs text-brand-700'>
          {formatter.format(new Date(displayDate))}
        </time>
      </article>
    </section>
  )
}
