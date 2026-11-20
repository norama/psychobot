import { Button } from '@/ui/Button'
import type { MessageTree } from '@/util/messageTree'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCard } from './MessageCard'

type MessageTreeViewProps = {
  tree: MessageTree
  userId: string
  selectedMessageId: string | null
  onSelect: (messageId: string | null) => void
}

type MessageViewProps = MessageTreeViewProps & {
  messageId: string
  expanded: Set<string>
  ancestors: Set<string>
  onToggle: (id: string) => void
}

function MessageView(props: MessageViewProps) {
  const { tree, userId, selectedMessageId, onSelect, messageId, expanded, ancestors, onToggle } =
    props

  const { t } = useTranslation()
  const message = tree.messagesById.get(messageId)!
  const children = tree.childrenById.get(messageId)!
  const open = expanded.has(messageId) || ancestors.has(messageId)

  return (
    <li className='min-w-0'>
      <MessageCard
        message={message}
        isOwn={message.created_by === userId}
        selected={messageId === selectedMessageId}
        onSelect={() => onSelect(messageId)}
      />

      {children.length > 0 && (
        <>
          <div className='mt-2 flex justify-end'>
            <button
              type='button'
              aria-expanded={open}
              onClick={() => onToggle(messageId)}
              className='cursor-pointer rounded px-2 py-1 text-sm text-brand-700 hover:bg-brand-100'>
              <span aria-hidden='true'>{open ? '▾' : '▸'} </span>
              {t(open ? 'messages.hideSources' : 'messages.showSources', {
                count: children.length,
              })}
            </button>
          </div>

          {open && (
            <ol className='mt-3 ml-3 space-y-4 border-l-2 border-brand-200 pl-3 md:ml-6 md:pl-4'>
              {children.map((childId) => (
                <MessageView {...props} key={childId} messageId={childId} />
              ))}
            </ol>
          )}
        </>
      )}
    </li>
  )
}

export function MessageTreeView({
  tree,
  userId,
  selectedMessageId,
  onSelect,
}: MessageTreeViewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // Always reveal the selected message's ancestors.
  const ancestors = new Set<string>()
  let parentId = selectedMessageId === null ? undefined : tree.parentById.get(selectedMessageId)

  while (parentId !== undefined) {
    ancestors.add(parentId)
    parentId = tree.parentById.get(parentId)
  }

  const atOverview = tree.rootIds.every((id) => !expanded.has(id) && !ancestors.has(id))

  function toggle(id: string) {
    const open = expanded.has(id) || ancestors.has(id)

    setExpanded((previous) => {
      const next = new Set(previous)
      if (open) next.delete(id)
      else next.add(id)
      return next
    })

    // Keep selection visible when closing its containing folder.
    if (open && ancestors.has(id)) onSelect(id)
  }

  return (
    <div className='mt-6'>
      <Button
        type='button'
        variant='secondary'
        className='mb-4'
        disabled={atOverview}
        onClick={() => {
          setExpanded(new Set())
          onSelect(null)
        }}>
        {t('messages.overview')}
      </Button>

      <ol className='space-y-4'>
        {tree.rootIds.map((id) => (
          <MessageView
            key={id}
            messageId={id}
            tree={tree}
            userId={userId}
            selectedMessageId={selectedMessageId}
            onSelect={onSelect}
            expanded={expanded}
            ancestors={ancestors}
            onToggle={toggle}
          />
        ))}
      </ol>
    </div>
  )
}
