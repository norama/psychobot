import {
  getSummarySourcesForMessages,
  setSummarySources,
  type SummarySource,
} from '@/db/summarySources'
import {
  createTopicMessage,
  deleteTopicMessage,
  getTopicMessages,
  shareTopicMessage,
  updateTopicMessage,
  type TopicMessage,
  type TopicMessageInput,
} from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { SummaryIcon } from '@/ui/icons/SummaryIcon'
import { getStoredMessage, storeMessage } from '@/util/messagePreference'
import { buildMessageTree } from '@/util/messageTree'
import { useMessageRoute } from '@/util/useMessageRoute'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageTreeView } from './MessageTreeView'
import { PreparationEntryComposer } from './PreparationEntryComposer'
import { SharedMessageList } from './SharedMessageList'
import { SummaryDraftDialog } from './SummaryDraftDialog'
import { SummarySourceDialog } from './SummarySourceDialog'

type WorkspacePreparationProps = {
  topicId: string
  userId: string
}

type EntriesState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      entries: TopicMessage[]
      sources: SummarySource[]
    }

async function loadTopicMessages(
  topicId: string,
  signal: AbortSignal,
): Promise<{
  entries: TopicMessage[]
  sources: SummarySource[]
}> {
  const messages = await getTopicMessages(topicId, signal)
  if (messages === null) throw new Error('Missing message list')

  signal.throwIfAborted()

  const sources = await getSummarySourcesForMessages(
    messages.map((message) => message.id),
    signal,
  )
  if (sources === null) throw new Error('Missing summary relationships')

  const entries = [...messages].sort((a, b) => {
    const dateA = new Date(a.shared_at ?? a.created_at).getTime()
    const dateB = new Date(b.shared_at ?? b.created_at).getTime()

    return dateA - dateB || a.id.localeCompare(b.id)
  })

  return { entries, sources }
}

export function WorkspacePreparation({ topicId, userId }: WorkspacePreparationProps) {
  const { t } = useTranslation()
  const { messageId, chooseMessage } = useMessageRoute()
  const [lastSavedMessageId, setLastSavedMessageId] = useState<string | null>(null)
  const [state, setState] = useState<EntriesState>({ status: 'loading' })
  const [saved, setSaved] = useState(false)
  const [composerState, setComposerState] = useState({
    dirty: false,
    saving: false,
  })
  const [sendNotice, setSendNotice] = useState<string | null>(null)
  const [sendRefreshFailed, setSendRefreshFailed] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const selectionRestoredRef = useRef(false)
  const [choosingSources, setChoosingSources] = useState(false)
  const [summarySourceIds, setSummarySourceIds] = useState<string[] | null>(null)
  const pendingSummaryIdRef = useRef<string | null>(null)

  const tree = useMemo(
    () => (state.status === 'ready' ? buildMessageTree(state.entries, state.sources) : null),
    [state],
  )

  const summaryCandidates = tree
    ? tree.rootIds
        .map((id) => tree.messagesById.get(id)!)
        .filter((message) => message.created_by === userId)
    : []

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller

    async function load() {
      setState({ status: 'loading' })

      try {
        const { entries, sources } = await loadTopicMessages(topicId, controller.signal)
        if (controller.signal.aborted) return

        setState({ status: 'ready', entries, sources })
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

  async function handleSave(input: TopicMessageInput) {
    const controller = controllerRef.current
    if (
      tree === null ||
      !controller ||
      controller.signal.aborted ||
      state.status !== 'ready' ||
      messageUnavailable
    ) {
      throw new Error('Message list is not ready')
    }

    setSaved(false)
    setRefreshFailed(false)

    let savedMessageId = pendingSummaryIdRef.current

    if (savedMessageId === null) {
      savedMessageId = await createTopicMessage(topicId, input)
      if (savedMessageId === null) throw new Error('Missing message ID')

      if (summarySourceIds !== null) {
        pendingSummaryIdRef.current = savedMessageId
      }
    } else {
      // Retry an incomplete summary save, including any text corrections.
      await updateTopicMessage(savedMessageId, input)
    }

    if (controller.signal.aborted) return

    if (summarySourceIds !== null) {
      await setSummarySources(savedMessageId, summarySourceIds)
      if (controller.signal.aborted) return
    }

    pendingSummaryIdRef.current = null
    setSummarySourceIds(null)

    setLastSavedMessageId(savedMessageId)
    chooseMessage(savedMessageId, { replace: true })

    setSaved(true)

    // Creation succeeded. A refresh failure must not turn it into a failed save,
    // because retrying creation would produce another entry.
    try {
      const { entries, sources } = await loadTopicMessages(topicId, controller.signal)
      if (controller.signal.aborted) return

      setState({ status: 'ready', entries, sources })
    } catch (error) {
      if (controller.signal.aborted) return

      console.error('Failed to refresh messages after saving', error)
      setRefreshFailed(true)
    }
  }

  async function handleUpdate(id: string, input: TopicMessageInput) {
    const controller = controllerRef.current
    const message =
      state.status === 'ready' ? state.entries.find((entry) => entry.id === id) : undefined

    if (
      !controller ||
      controller.signal.aborted ||
      message?.created_by !== userId ||
      message.status !== 'draft'
    ) {
      throw new Error('Message is not editable')
    }

    setSaved(false)
    setRefreshFailed(false)

    await updateTopicMessage(id, input)
    if (controller.signal.aborted) return

    // Reflect the successful save even if the following refresh fails.
    setState((previous) =>
      previous.status !== 'ready'
        ? previous
        : {
            ...previous,
            entries: previous.entries.map((entry) =>
              entry.id === id
                ? { ...entry, content: input.content, title: input.title ?? null }
                : entry,
            ),
          },
    )
    setSaved(true)

    try {
      const { entries, sources } = await loadTopicMessages(topicId, controller.signal)
      if (controller.signal.aborted) return

      setState({ status: 'ready', entries, sources })
    } catch (error) {
      if (controller.signal.aborted) return

      console.error('Failed to refresh messages after editing', error)
      setRefreshFailed(true)
    }
  }

  async function handleDelete(id: string) {
    const controller = controllerRef.current
    const message =
      state.status === 'ready' ? state.entries.find((entry) => entry.id === id) : undefined

    if (
      !controller ||
      controller.signal.aborted ||
      message?.created_by !== userId ||
      message.status !== 'draft'
    ) {
      throw new Error('Message is not deletable')
    }

    await deleteTopicMessage(id)
    if (controller.signal.aborted) return

    setSaved(false)

    setState((previous) =>
      previous.status !== 'ready'
        ? previous
        : {
            ...previous,
            entries: previous.entries.filter((entry) => entry.id !== id),
            sources: previous.sources.filter(
              (source) => source.summary_id !== id && source.source_id !== id,
            ),
          },
    )

    setLastSavedMessageId((previous) => (previous === id ? null : previous))

    if (getStoredMessage(userId, topicId) === id) {
      storeMessage(userId, topicId, null)
    }

    if (messageId === id) {
      chooseMessage(null, { replace: true })
    }
  }

  async function handleSend(id: string) {
    const controller = controllerRef.current
    const message =
      state.status === 'ready' ? state.entries.find((entry) => entry.id === id) : undefined

    if (
      !controller ||
      controller.signal.aborted ||
      tree === null ||
      message?.created_by !== userId ||
      message.status === 'shared' ||
      composerState.dirty ||
      composerState.saving ||
      choosingSources ||
      summarySourceIds !== null ||
      pendingSummaryIdRef.current !== null
    ) {
      throw new Error('Message is not ready to send')
    }

    setSaved(false)
    setSendNotice(null)
    setSendRefreshFailed(false)

    let result: Awaited<ReturnType<typeof shareTopicMessage>> = null

    try {
      result = await shareTopicMessage(id)
    } finally {
      // Even a failed send may have frozen the message and its sources.
      if (!controller.signal.aborted) {
        try {
          const { entries, sources } = await loadTopicMessages(topicId, controller.signal)
          if (!controller.signal.aborted) {
            setState({ status: 'ready', entries, sources })
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Failed to refresh messages after sending', error)
            setSendRefreshFailed(true)
            setState({ status: 'error' })
          }
        }
      }
    }

    if (controller.signal.aborted) return

    if (!result?.shared) {
      throw new Error('Message sharing was not confirmed')
    }

    setSendNotice(
      result.emailSubmitted === false
        ? t('messages.sentWithoutEmail')
        : t('messages.sentSuccessfully'),
    )
  }

  async function handleCancelSummary() {
    const pendingId = pendingSummaryIdRef.current

    if (pendingId !== null) {
      await deleteTopicMessage(pendingId)
      pendingSummaryIdRef.current = null
    }

    setSummarySourceIds(null)
  }

  const errorMessage =
    state.status === 'loading'
      ? null
      : state.status === 'error'
        ? t(sendRefreshFailed ? 'messages.sendRefreshFailed' : 'messages.loadFailed')
        : tree === null
          ? t('messages.invalidTree')
          : messageUnavailable
            ? t('messages.messageUnavailable')
            : null

  return (
    <section className='mt-6'>
      <h3 className='text-lg font-semibold'>{t('messages.title')}</h3>
      <p className='mt-2 text-sm text-brand-700'>{t('messages.privacyHint')}</p>

      {sendNotice && (
        <p role='status' className='mt-3 text-sm text-brand-700'>
          {sendNotice}
        </p>
      )}

      {state.status === 'ready' && (
        <div className='mt-4 grid grid-cols-1 items-start gap-3 md:grid-cols-2'>
          <SharedMessageList
            title={t('messages.received')}
            emptyText={t('messages.noReceived')}
            messages={state.entries.filter(
              (message) => message.status === 'shared' && message.created_by !== userId,
            )}
          />

          <SharedMessageList
            title={t('messages.sent')}
            emptyText={t('messages.noSent')}
            messages={state.entries.filter(
              (message) => message.status === 'shared' && message.created_by === userId,
            )}
          />
        </div>
      )}

      {state.status === 'loading' ? (
        <p role='status' className='mt-4'>
          {t('messages.loading')}
        </p>
      ) : errorMessage ? (
        <p role='alert' className='mt-4'>
          {errorMessage}
        </p>
      ) : (
        tree !== null && (
          <MessageTreeView
            tree={tree}
            userId={userId}
            selectedMessageId={messageId}
            onSelect={(id: string | null) => {
              if (id === null) storeMessage(userId, topicId, null)
              chooseMessage(id)
            }}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onSend={handleSend}
            sendDisabled={
              composerState.dirty ||
              composerState.saving ||
              choosingSources ||
              summarySourceIds !== null
            }
          />
        )
      )}

      {state.status === 'ready' && tree !== null && !messageUnavailable && (
        <div className='ml-auto w-full md:max-w-[92%]'>
          <div className='mt-6'>
            <Button
              type='button'
              variant='secondary'
              className='inline-flex items-center gap-2'
              disabled={
                composerState.saving ||
                summaryCandidates.length === 0 ||
                choosingSources ||
                summarySourceIds !== null
              }
              onClick={() => {
                setSaved(false)
                setChoosingSources(true)
              }}>
              <SummaryIcon />
              {t('messages.createSummary')}
            </Button>
          </div>
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
        </div>
      )}
      {choosingSources && tree !== null && (
        <SummarySourceDialog
          candidates={summaryCandidates}
          onClose={() => setChoosingSources(false)}
          onSelected={(ids) => {
            setSummarySourceIds(ids)
            setChoosingSources(false)
            setSaved(false)
          }}
        />
      )}
      {summarySourceIds !== null && state.status === 'ready' && (
        <SummaryDraftDialog
          sources={state.entries.filter((message) => summarySourceIds.includes(message.id))}
          onSave={handleSave}
          onCancel={handleCancelSummary}
        />
      )}
    </section>
  )
}
