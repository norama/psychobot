import { Button } from '@/ui/Button'
import { useTopicRoute } from '@/util/useTopicRoute'
import { useTopics } from '@/util/useTopics'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NewTopicDialog } from './NewTopicDialog'

export function WorkspaceTopics({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation()
  const { chooseTopic } = useTopicRoute()
  const [creating, setCreating] = useState(false)
  const { state, reload } = useTopics(workspaceId)

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
                <li key={topic.id} className='rounded-lg px-3 py-2'>
                  <p className='break-words font-medium'>{topic.title}</p>
                  <time dateTime={topic.created_at} className='block text-xs text-brand-700'>
                    {dateFormatter.format(new Date(topic.created_at))}
                  </time>
                </li>
              ))}
            </ul>
          ))}
      </aside>

      <section className='min-w-0 p-4'>
        <p className='text-brand-700'>{t('topics.selectPrompt')}</p>
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
