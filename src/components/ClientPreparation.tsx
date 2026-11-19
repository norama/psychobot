import { createTopicMessage, getTopicMessages, type TopicMessage } from '@/db/topicMessages'
import { getStoredMessage, storeMessage } from '@/util/messagePreference'
import { useMessageRoute } from '@/util/useMessageRoute'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCard } from './MessageCard'
import { PreparationEntryComposer } from './PreparationEntryComposer'

type ClientPreparationProps = {
  topicId: string
  userId: string
}

type EntriesState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: TopicMessage[] }

async function loadTopicMessages(topicId: string, signal: AbortSignal): Promise<TopicMessage[]> {
  const messages = await getTopicMessages(topicId, signal)
  if (messages === null) throw new Error('Missing message list')

  return [...messages].sort((a, b) => {
    const dateA = new Date(a.shared_at ?? a.created_at).getTime()
    const dateB = new Date(b.shared_at ?? b.created_at).getTime()

    return dateA - dateB || a.id.localeCompare(b.id)
  })
}

export function ClientPreparation({ topicId, userId }: ClientPreparationProps) {
  const { t } = useTranslation()
  const { messageId, chooseMessage } = useMessageRoute()
  const [lastSavedMessageId, setLastSavedMessageId] = useState<string | null>(null)
  const [state, setState] = useState<EntriesState>({ status: 'loading' })
  const [saved, setSaved] = useState(false)
  const [composerState, setComposerState] = useState({
    dirty: false,
    saving: false,
  })
  const [refreshFailed, setRefreshFailed] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const selectionRestoredRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller

    async function load() {
      setState({ status: 'loading' })

      try {
        const entries = await loadTopicMessages(topicId, controller.signal)
        if (controller.signal.aborted) return

        setState({ status: 'ready', entries })
      } catch (error) {
        if (controller.signal.aborted) return

        console.error('Failed to load messages', error)
        setState({ status: 'error' })
      }
    }

    void load()

    return () => controller.abort()
  }, [topicId, userId])

  const selectedEntry =
    state.status === 'ready' ? state.entries.find((entry) => entry.id === messageId) : undefined

  const messageUnavailable =
    state.status === 'ready' &&
    messageId !== null &&
    !selectedEntry &&
    lastSavedMessageId !== messageId

  useEffect(() => {
    if (state.status !== 'ready' || selectionRestoredRef.current) return
    selectionRestoredRef.current = true

    // Explicit URL selection always wins.
    if (messageId !== null) return

    const storedMessageId = getStoredMessage(userId, topicId)
    if (storedMessageId === null) return

    if (state.entries.some((entry) => entry.id === storedMessageId)) {
      chooseMessage(storedMessageId, { replace: true })
    } else {
      storeMessage(userId, topicId, null)
    }
  }, [state, messageId, userId, topicId, chooseMessage])

  useEffect(() => {
    const validSelection = selectedEntry?.id === messageId || lastSavedMessageId === messageId

    if (messageId !== null && validSelection) {
      storeMessage(userId, topicId, messageId)
    }
  }, [messageId, selectedEntry?.id, lastSavedMessageId, userId, topicId])

  async function handleSave(input: { title: string | null; content: string }) {
    const controller = controllerRef.current
    if (
      !controller ||
      controller.signal.aborted ||
      state.status !== 'ready' ||
      messageUnavailable
    ) {
      throw new Error('Message list is not ready')
    }

    setSaved(false)
    setRefreshFailed(false)

    const messageId = await createTopicMessage(topicId, input)

    if (messageId === null) throw new Error('Missing message ID')
    if (controller.signal.aborted) return

    setLastSavedMessageId(messageId)
    chooseMessage(messageId, { replace: true })

    setSaved(true)

    // Creation succeeded. A refresh failure must not turn it into a failed save,
    // because retrying creation would produce another entry.
    try {
      const entries = await loadTopicMessages(topicId, controller.signal)
      if (controller.signal.aborted) return

      setState({ status: 'ready', entries })
    } catch (error) {
      if (controller.signal.aborted) return

      console.error('Failed to refresh messages after saving', error)
      setRefreshFailed(true)
    }
  }

  const currentEntries = state.status === 'ready' ? state.entries : []

  return (
    <section className='mt-6'>
      <h3 className='text-lg font-semibold'>{t('messages.title')}</h3>
      <p className='mt-2 text-sm text-brand-700'>{t('messages.privacyHint')}</p>

      {state.status === 'loading' ? (
        <p role='status' className='mt-4'>
          {t('messages.loading')}
        </p>
      ) : state.status === 'error' ? (
        <p role='alert' className='mt-4'>
          {t('messages.loadFailed')}
        </p>
      ) : messageUnavailable ? (
        <p role='alert' className='mt-4'>
          {t('messages.messageUnavailable')}
        </p>
      ) : currentEntries.length === 0 ? (
        <p className='mt-4 text-brand-700'>{t('messages.empty')}</p>
      ) : (
        <ol className='mt-6 space-y-4'>
          {currentEntries.map((entry) => (
            <li key={entry.id}>
              <MessageCard
                message={entry}
                isOwn={entry.created_by === userId}
                selected={entry.id === messageId}
                onSelect={() => chooseMessage(entry.id)}
              />
            </li>
          ))}
        </ol>
      )}
      {state.status === 'ready' && !messageUnavailable && (
        <>
          <PreparationEntryComposer onSave={handleSave} onStateChange={setComposerState} />

          {saved && (
            <p role='status' className='mt-3 text-sm text-brand-700'>
              {t('messages.saved')}
            </p>
          )}

          {refreshFailed && (
            <p role='alert' className='mt-3 text-sm'>
              {t('messages.refreshFailed')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
