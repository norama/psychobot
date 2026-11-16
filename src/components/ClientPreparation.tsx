import { createTopicMessage, getTopicMessages, type TopicMessage } from '@/db/topicMessages'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PreparationEntryComposer } from './PreparationEntryComposer'

type ClientPreparationProps = {
  topicId: string
  userId: string
}

type EntriesState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: TopicMessage[] }

async function loadPreparationEntries(
  topicId: string,
  userId: string,
  signal: AbortSignal,
): Promise<TopicMessage[]> {
  const messages = await getTopicMessages(topicId, signal)
  if (messages === null) throw new Error('Missing message list')

  return messages.filter(
    (message) =>
      message.created_by === userId && message.type === 'entry' && message.status === 'draft',
  )
}

export function ClientPreparation({ topicId, userId }: ClientPreparationProps) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<EntriesState>({ status: 'loading' })
  const [preparationId, setPreparationId] = useState<string>(() => crypto.randomUUID())
  const [saved, setSaved] = useState(false)
  const [composerState, setComposerState] = useState({
    dirty: false,
    saving: false,
  })
  const [refreshFailed, setRefreshFailed] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller

    async function load() {
      setState({ status: 'loading' })

      try {
        const entries = await loadPreparationEntries(topicId, userId, controller.signal)
        if (controller.signal.aborted) return

        const lastEntry = entries[entries.length - 1]
        if (lastEntry) setPreparationId(lastEntry.preparation_id)

        setState({ status: 'ready', entries })
      } catch (error) {
        console.error('Failed to load preparation entries', error)
        if (!controller.signal.aborted) {
          setState({ status: 'error' })
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [topicId, userId])

  async function handleSave(input: { title: string | null; content: string }) {
    const controller = controllerRef.current
    if (!controller || controller.signal.aborted || state.status !== 'ready') {
      throw new Error('Preparation is not ready')
    }

    setSaved(false)
    setRefreshFailed(false)

    const messageId = await createTopicMessage(topicId, {
      preparationId,
      type: 'entry',
      ...input,
    })

    if (messageId === null) throw new Error('Missing message ID')
    if (controller.signal.aborted) return

    setSaved(true)

    // Creation succeeded. A refresh failure must not turn it into a failed save,
    // because retrying creation would produce another entry.
    try {
      const entries = await loadPreparationEntries(topicId, userId, controller.signal)
      if (controller.signal.aborted) return

      setState({ status: 'ready', entries })
    } catch (error) {
      console.error('Failed to refresh preparation entries after saving', error)
      if (!controller.signal.aborted) setRefreshFailed(true)
    }
  }

  const currentEntries =
    state.status === 'ready'
      ? state.entries.filter((entry) => entry.preparation_id === preparationId)
      : []

  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <section className='mt-6'>
      <h3 className='text-lg font-semibold'>{t('preparations.title')}</h3>
      <p className='mt-2 text-sm text-brand-700'>{t('preparations.privateHint')}</p>

      {state.status === 'loading' ? (
        <p role='status' className='mt-4'>
          {t('preparations.loading')}
        </p>
      ) : state.status === 'error' ? (
        <p role='alert' className='mt-4'>
          {t('preparations.loadFailed')}
        </p>
      ) : currentEntries.length === 0 ? (
        <p className='mt-4 text-brand-700'>{t('preparations.empty')}</p>
      ) : (
        <ol className='mt-6 space-y-4'>
          {currentEntries.map((entry) => (
            <li
              key={entry.id}
              className='ml-auto w-fit max-w-full rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 md:max-w-[85%]'>
              {entry.title && <h4 className='break-words font-semibold'>{entry.title}</h4>}
              <p className='whitespace-pre-wrap break-words'>{entry.content}</p>
              <time dateTime={entry.created_at} className='mt-2 block text-xs text-brand-700'>
                {dateFormatter.format(new Date(entry.created_at))}
              </time>
            </li>
          ))}
        </ol>
      )}
      {state.status === 'ready' && (
        <>
          <PreparationEntryComposer onSave={handleSave} onStateChange={setComposerState} />

          {saved && (
            <p role='status' className='mt-3 text-sm text-brand-700'>
              {t('preparations.saved')}
            </p>
          )}

          {refreshFailed && (
            <p role='alert' className='mt-3 text-sm'>
              {t('preparations.refreshFailed')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
