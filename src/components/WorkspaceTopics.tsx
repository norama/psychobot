import { useTranslation } from 'react-i18next'

export function WorkspaceTopics() {
  const { t } = useTranslation()

  return (
    <div className='grid min-h-[calc(100dvh-16rem)] grid-cols-1 md:grid-cols-[18rem_minmax(0,1fr)]'>
      <aside className='border-b border-brand-200 bg-brand-50 p-4 md:border-r md:border-b-0'>
        <h2 className='font-semibold'>{t('topics.title')}</h2>
      </aside>

      <section className='min-w-0 p-4'>
        <p className='text-brand-700'>{t('topics.selectPrompt')}</p>
      </section>
    </div>
  )
}
