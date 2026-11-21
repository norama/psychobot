import type { TopicMessageInput } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import type { MessageTree } from '@/util/messageTree'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCard } from './MessageCard'

type MessageTreeViewProps = {
  tree: MessageTree
  userId: string
  selectedMessageId: string | null
  onSelect: (messageId: string | null) => void
  onUpdate: (messageId: string, input: TopicMessageInput) => Promise<void>
  onDelete: (messageId: string) => Promise<void>
}

type MessageViewProps = MessageTreeViewProps & {
  messageId: string
  expanded: Set<string>
  ancestors: Set<string>
  onToggle: (id: string) => void
  editingMessageId: string | null
  onEdit: (messageId: string | null) => void
  onEditorStateChange: (state: { dirty: boolean; saving: boolean }) => void
  onCancelEdit: () => void
}

function MessageView(props: MessageViewProps) {
  const {
    tree,
    userId,
    selectedMessageId,
    onSelect,
    onUpdate,
    onDelete,
    onCancelEdit,
    messageId,
    expanded,
    ancestors,
    onToggle,
    editingMessageId,
    onEdit,
    onEditorStateChange,
  } = props

  const { t } = useTranslation()
  const message = tree.messagesById.get(messageId)!
  const children = tree.childrenById.get(messageId)!
  const open = expanded.has(messageId) || ancestors.has(messageId)

  return (
    <li className='min-w-0'>
      <MessageCard
        message={message}
        isOwn={message.created_by === userId}
        isSummary={children.length > 0}
        selected={messageId === selectedMessageId}
        onSelect={() => onSelect(messageId)}
        editing={editingMessageId === messageId}
        editDisabled={editingMessageId !== null}
        isSource={tree.parentById.has(messageId)}
        onEdit={() => onEdit(messageId)}
        onDelete={() => onDelete(messageId)}
        onCancel={onCancelEdit}
        onSave={async (input) => {
          await onUpdate(messageId, input)
          onEdit(null)
        }}
        onEditorStateChange={onEditorStateChange}
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
                <MessageView
                  {...props}
                  key={childId}
                  messageId={childId}
                  onUpdate={onUpdate}
                  editingMessageId={editingMessageId}
                  onEdit={onEdit}
                  onCancelEdit={onCancelEdit}
                  onEditorStateChange={onEditorStateChange}
                  onDelete={onDelete}
                />
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
  onUpdate,
  onDelete,
}: MessageTreeViewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editorState, setEditorState] = useState({
    dirty: false,
    saving: false,
  })
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null)

  function changeEditor(id: string | null) {
    setEditorState({ dirty: false, saving: false })
    setEditingMessageId(id)
  }

  function requestCloseEditor(action: () => void) {
    if (editingMessageId !== null && editorState.saving) return

    const proceed = () => {
      changeEditor(null)
      action()
    }

    if (editingMessageId !== null && editorState.dirty) {
      setPendingDiscard(() => proceed)
    } else {
      proceed()
    }
  }

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

    function applyToggle() {
      setExpanded((previous) => {
        const next = new Set(previous)
        if (open) next.delete(id)
        else next.add(id)
        return next
      })

      if (open && ancestors.has(id)) onSelect(id)
    }

    // Closing this branch would unmount a descendant editor.
    let parentId = editingMessageId === null ? undefined : tree.parentById.get(editingMessageId)

    while (parentId !== undefined) {
      if (open && parentId === id) {
        requestCloseEditor(applyToggle)
        return
      }

      parentId = tree.parentById.get(parentId)
    }

    applyToggle()
  }

  return (
    <div className='mt-6'>
      <Button
        type='button'
        variant='secondary'
        className='mb-4'
        disabled={atOverview}
        onClick={() =>
          requestCloseEditor(() => {
            setExpanded(new Set())
            onSelect(null)
          })
        }>
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
            onUpdate={onUpdate}
            onDelete={onDelete}
            expanded={expanded}
            ancestors={ancestors}
            onToggle={toggle}
            editingMessageId={editingMessageId}
            onEdit={changeEditor}
            onCancelEdit={() => requestCloseEditor(() => {})}
            onEditorStateChange={setEditorState}
          />
        ))}
      </ol>
      {pendingDiscard !== null && (
        <Dialog
          title={t('messages.discardTitle')}
          onClose={() => setPendingDiscard(null)}
          showCloseButton={false}>
          <p>{t('messages.discardHint')}</p>

          <div className='mt-6 flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={() => setPendingDiscard(null)}>
              {t('messages.keepEditing')}
            </Button>

            <Button
              type='button'
              onClick={() => {
                const proceed = pendingDiscard
                setPendingDiscard(null)
                proceed()
              }}>
              {t('messages.discardChanges')}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
