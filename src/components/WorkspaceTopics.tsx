import { Button } from '@/ui/Button'
import { storeTopic } from '@/util/topicPreference'
import { useTopicRoute } from '@/util/useTopicRoute'
import { useTopics } from '@/util/useTopics'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NewTopicDialog } from './NewTopicDialog'

type WorkspaceTopicsProps = {
  workspaceId: string
  renderTopicContent?: (topicId: string) => ReactNode
}

export function WorkspaceTopics({ workspaceId, renderTopicContent }: WorkspaceTopicsProps) {
  const { t, i18n } = useTranslation()
  const { topicId, chooseTopic } = useTopicRoute()
  const [creating, setCreating] = useState(false)
  const { state, reload } = useTopics(workspaceId)

  const selectedTopic =
    state.status === 'ready' ? state.topics.find((topic) => topic.id === topicId) : undefined

  useEffect(() => {
    if (state.status !== 'ready') return
    storeTopic(workspaceId, selectedTopic?.id ?? null)
  }, [workspaceId, state.status, selectedTopic?.id])

  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <div className='grid min-h-[calc(100dvh-16rem)] grid-cols-1 md:grid-cols-[18rem_minmax(0,1fr)]'>
      <aside className='border-b border-brand-200 bg-brand-50 p-4 md:border-r md:border-b-0'>
        <h2 className='font-semibold'>{t('topics.title')}</h2>
        <Button
          type='button'
          variant='secondary'
          className='mt-3 w-full'
          onClick={() => setCreating(true)}>
          {t('topics.new')}
        </Button>
        {state.status === 'loading' && (
          <p role='status' className='mt-4 text-sm'>
            {t('topics.loading')}
          </p>
        )}

        {state.status === 'error' && (
          <p role='alert' className='mt-4 text-sm'>
            {t('topics.loadFailed')}
          </p>
        )}

        {state.status === 'ready' &&
          (state.topics.length === 0 ? (
            <p className='mt-4 text-sm text-brand-700'>{t('topics.empty')}</p>
          ) : (
            <ul className='mt-4 space-y-2'>
              {state.topics.map((topic) => (
                <li key={topic.id}>
                  <button
                    type='button'
                    onClick={() => {
                      if (topic.id !== topicId) chooseTopic(topic.id)
                    }}
                    aria-current={topic.id === topicId ? 'true' : undefined}
                    className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left hover:bg-brand-100 ${
                      topic.id === topicId ? 'bg-brand-100 font-semibold' : ''
                    }`}>
                    <span className='block break-words'>{topic.title}</span>
                    <time
                      dateTime={topic.created_at}
                      className='block text-xs font-normal text-brand-700'>
                      {dateFormatter.format(new Date(topic.created_at))}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </aside>

      <section className='min-w-0 p-6'>
        {state.status === 'loading' ? (
          <p role='status'>{t('topics.loading')}</p>
        ) : state.status === 'error' ? (
          <p role='alert'>{t('topics.loadFailed')}</p>
        ) : topicId === null ? (
          <p className='text-brand-700'>{t('topics.selectPrompt')}</p>
        ) : !selectedTopic ? (
          <p role='alert'>{t('topics.unavailable')}</p>
        ) : (
          <>
            <h2 className='break-words text-xl font-semibold'>{selectedTopic.title}</h2>

            {selectedTopic.description && (
              <p className='mt-3 whitespace-pre-wrap break-words text-brand-800'>
                {selectedTopic.description}
              </p>
            )}

            {renderTopicContent ? (
              renderTopicContent(selectedTopic.id)
            ) : (
              <p className='mt-6 text-brand-700'>{t('topics.contentComingSoon')}</p>
            )}
          </>
        )}
      </section>

      {creating && (
        <NewTopicDialog
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={(topicId) => {
            setCreating(false)
            void reload()
            chooseTopic(topicId)
          }}
        />
      )}
    </div>
  )
}
