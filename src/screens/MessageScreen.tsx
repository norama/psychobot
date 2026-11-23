import { CopyMessageLinkButton } from '@/components/CopyMessageLinkButton'
import { MessageTimestamp } from '@/components/MessageTimestamp'
import type { MessageReadReceipt } from '@/db/topicMessages'
import { getSharedMessage } from '@/db/topicMessages'
import { MarkdownContent } from '@/ui/MarkdownContent'
import { useMessageRead } from '@/util/useMessageRead'
import { useMessageReadReceipts } from '@/util/useMessageReadReceipts'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

type MessageData = NonNullable<Awaited<ReturnType<typeof getSharedMessage>>>

type MessageState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; data: MessageData }

export function MessageScreen({ userId }: { userId: string }) {
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

  const handleRead = useCallback((id: string, readAt: string) => {
    setState((current) => {
      if (
        current.status !== 'ready' ||
        current.data.message.id !== id ||
        current.data.message.read_at !== null
      ) {
        return current
      }

      return {
        ...current,
        data: {
          ...current.data,
          message: {
            ...current.data.message,
            read_at: current.data.message.read_at ?? readAt,
          },
        },
      }
    })
  }, [])

  useMessageRead(
    state.status === 'ready' && state.data.message.id === messageId ? state.data.message : null,
    userId,
    handleRead,
  )

  const handleRefreshReadReceipts = useCallback(
    (receipts: MessageReadReceipt[]) => {
      const receipt = receipts.find((item) => item.id === messageId)

      if (receipt?.read_at) {
        handleRead(receipt.id, receipt.read_at)
      }
    },
    [messageId, handleRead],
  )

  useMessageReadReceipts(
    state.status === 'ready' ? state.data.message.topic_id : null,
    userId,
    handleRefreshReadReceipts,
  )

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

        <div className='mt-4 flex items-center justify-between gap-3'>
          <MessageTimestamp message={message} showReadReceipt={message.created_by === userId} />

          <CopyMessageLinkButton message={message} />
        </div>
      </article>
    </section>
  )
}
