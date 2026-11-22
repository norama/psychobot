import type { TopicMessage, TopicMessageInput } from '@/db/topicMessages'
import { Button } from '@/ui/Button'
import { DeleteIcon } from '@/ui/icons/DeleteIcon'
import { EditIcon } from '@/ui/icons/EditIcon'
import { LockIcon } from '@/ui/icons/LockIcon'
import { SummaryIcon } from '@/ui/icons/SummaryIcon'
import { MarkdownContent } from '@/ui/MarkdownContent'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyMessageLinkButton } from './CopyMessageLinkButton'
import { DeleteMessageDialog } from './DeleteMessageDialog'
import { MessageTimestamp } from './MessageTimestamp'
import { PreparationEntryComposer } from './PreparationEntryComposer'

type MessageCardProps = {
  message: TopicMessage
  isOwn: boolean
  isSummary: boolean
  selected: boolean
  onSelect: () => void
  editing: boolean
  editDisabled: boolean
  isSource: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
  onCancel: () => void
  onSave: (input: TopicMessageInput) => Promise<void>
  onEditorStateChange: (state: { dirty: boolean; saving: boolean }) => void
}

type MessagePreviewProps = Pick<
  MessageCardProps,
  'message' | 'isOwn' | 'isSummary' | 'selected' | 'onSelect'
>

function MessagePreview({ message, isOwn, isSummary, selected, onSelect }: MessagePreviewProps) {
  const { t } = useTranslation()
  const collapsed = !isOwn && !selected

  const statusKey = !isOwn
    ? 'received'
    : message.status === 'shared'
      ? 'sent'
      : message.status === 'final'
        ? 'final'
        : 'draft'

  function selectMessage() {
    if (window.getSelection()?.toString()) return
    if (!selected) onSelect()
  }

  return (
    <div
      className='cursor-pointer px-4 py-3'
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a, button, input')) {
          return
        }

        selectMessage()
      }}>
      <button
        type='button'
        aria-pressed={selected}
        onClick={selectMessage}
        className='block w-full cursor-pointer rounded text-left'>
        <span className='mb-2 flex items-center gap-2 text-xs font-medium text-brand-700'>
          {isSummary && (
            <>
              <SummaryIcon />
              <span className='sr-only'>{t('messages.summary')}</span>
            </>
          )}
          {t(`messages.status.${statusKey}`)}
        </span>

        {message.title && <span className='block break-words font-semibold'>{message.title}</span>}
      </button>

      <div className={collapsed ? 'line-clamp-2' : undefined}>
        <MarkdownContent>{message.content}</MarkdownContent>
      </div>
    </div>
  )
}

export function MessageCard({
  message,
  isOwn,
  isSummary,
  selected,
  onSelect,
  editing,
  editDisabled,
  isSource,
  onEdit,
  onCancel,
  onSave,
  onEditorStateChange,
  onDelete,
}: MessageCardProps) {
  const { t } = useTranslation()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div
      className={`w-full max-w-full rounded-2xl border transition-colors md:max-w-[85%] ${
        isOwn ? 'ml-auto' : 'mr-auto'
      } ${
        selected
          ? 'border-brand-700 bg-brand-100 ring-1 ring-brand-700'
          : isOwn
            ? 'border-brand-200 bg-brand-50 hover:border-brand-500 hover:bg-brand-100'
            : 'border-brand-300 bg-white hover:border-brand-500 hover:bg-brand-50'
      }`}>
      {editing ? (
        <div className='px-4 pb-4'>
          {isSummary && (
            <p className='pt-3 text-sm text-brand-700'>{t('messages.editSummaryHint')}</p>
          )}

          {isSource && (
            <p className='pt-3 text-sm text-brand-700'>{t('messages.editSourceHint')}</p>
          )}

          <PreparationEntryComposer
            initialValue={{ title: message.title, content: message.content }}
            onSave={onSave}
            onCancel={onCancel}
            onStateChange={onEditorStateChange}
            mode='edit'
          />
        </div>
      ) : (
        <>
          <MessagePreview
            message={message}
            isOwn={isOwn}
            isSummary={isSummary}
            selected={selected}
            onSelect={onSelect}
          />

          <div className='flex items-center justify-between gap-3 px-4 pb-3'>
            <MessageTimestamp message={message} />

            <div className='flex h-10 shrink-0 items-center gap-2'>
              {message.status === 'shared' && <CopyMessageLinkButton message={message} />}
              {isOwn && message.status === 'draft' ? (
                <div className={`flex gap-2 ${selected ? 'visible' : 'invisible'}`}>
                  <Button
                    type='button'
                    variant='secondary'
                    className='inline-flex h-10 w-10 items-center justify-center p-2'
                    title={t('messages.edit')}
                    aria-label={t('messages.edit')}
                    disabled={editDisabled}
                    onClick={onEdit}>
                    <EditIcon />
                  </Button>

                  <Button
                    type='button'
                    variant='secondary'
                    className='inline-flex h-10 w-10 items-center justify-center p-2'
                    title={t('messages.delete')}
                    aria-label={t('messages.delete')}
                    disabled={editDisabled}
                    onClick={() => setConfirmingDelete(true)}>
                    <DeleteIcon />
                  </Button>
                </div>
              ) : message.status !== 'draft' ? (
                <span
                  className='inline-flex h-10 w-10 items-center justify-center text-brand-700'
                  title={t('messages.locked')}>
                  <LockIcon />
                  <span className='sr-only'>{t('messages.locked')}</span>
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}

      {confirmingDelete && (
        <DeleteMessageDialog
          message={message}
          isSummary={isSummary}
          isSource={isSource}
          onDelete={onDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
