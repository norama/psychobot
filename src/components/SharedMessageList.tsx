import type { TopicMessage } from '@/db/topicMessages'
import { AppLink } from '@/ui/AppLink'
import { getMessageUrl } from '@/util/messageUrl'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyMessageLinkButton } from './CopyMessageLinkButton'
import { MessageTimestamp } from './MessageTimestamp'

type SharedMessageListProps = {
  title: string
  emptyText: string
  messages: TopicMessage[]
}

export function SharedMessageList({ title, emptyText, messages }: SharedMessageListProps) {
  const { t } = useTranslation()
  const searchId = useId()
  const [search, setSearch] = useState('')

  const query = search.trim().toLocaleLowerCase()

  const visibleMessages = messages
    .filter(
      (message) =>
        !query ||
        (message.title ?? '').toLocaleLowerCase().includes(query) ||
        message.content.toLocaleLowerCase().includes(query),
    )
    .sort((a, b) => {
      const dateA = new Date(a.shared_at ?? a.created_at).getTime()
      const dateB = new Date(b.shared_at ?? b.created_at).getTime()

      return dateB - dateA || a.id.localeCompare(b.id)
    })

  return (
    <details className='rounded-xl border border-brand-200 bg-brand-50 min-w-0'>
      <summary className='cursor-pointer px-4 py-3 font-medium'>
        {title} ({messages.length})
      </summary>

      <div className='px-4 pb-4'>
        {messages.length === 0 ? (
          <p className='text-sm text-brand-700'>{emptyText}</p>
        ) : (
          <>
            <label htmlFor={searchId} className='text-sm font-medium'>
              {t('messages.search')}
            </label>

            <input
              id={searchId}
              type='search'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className='mt-1 block w-full rounded-lg border border-brand-300 bg-white px-3 py-2 [&::-webkit-search-cancel-button]:cursor-pointer'
            />

            {visibleMessages.length === 0 ? (
              <p role='status' className='mt-3 text-sm text-brand-700'>
                {t('messages.noSearchResults')}
              </p>
            ) : (
              <ul className='mt-3 max-h-80 space-y-2 overflow-y-auto'>
                {visibleMessages.map((message) => (
                  <li key={message.id} className='rounded-lg border border-brand-200 bg-white p-3'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0 flex-1'>
                        <AppLink
                          to={getMessageUrl(message.id)}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='break-words font-medium'>
                          {message.title || t('messages.untitled')}
                        </AppLink>

                        <div className='mt-1'>
                          <MessageTimestamp message={message} />
                        </div>
                      </div>

                      <CopyMessageLinkButton message={message} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </details>
  )
}
