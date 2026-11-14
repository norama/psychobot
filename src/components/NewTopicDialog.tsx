import { createTopic } from '@/db/topics'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

type NewTopicDialogProps = {
  workspaceId: string
  onClose: () => void
  onCreated: (topicId: string) => void
}

export function NewTopicDialog({ workspaceId, onClose, onCreated }: NewTopicDialogProps) {
  const { t } = useTranslation()
  const id = useId()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleError, setTitleError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleCreate() {
    if (saving) return

    const trimmedTitle = title.trim()
    setTitleError(!trimmedTitle)
    setFailed(false)
    if (!trimmedTitle) return

    setSaving(true)

    let topicId: string

    try {
      const result = await createTopic(workspaceId, {
        title: trimmedTitle,
        description: description.trim() || null,
      })

      if (result === null) throw new Error('Missing topic ID')
      topicId = result
    } catch {
      setFailed(true)
      return
    } finally {
      setSaving(false)
    }

    onCreated(topicId)
  }

  const fieldClass = 'mt-1 block w-full rounded-lg border border-brand-300 bg-white px-3 py-2'

  return (
    <Dialog title={t('topics.new')} onClose={onClose} dismissible={!saving}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleCreate()
        }}>
        <fieldset disabled={saving} className='space-y-4'>
          <div>
            <label htmlFor={`${id}-title`} className='font-medium'>
              {t('topics.titleLabel')}
            </label>
            <input
              id={`${id}-title`}
              autoFocus
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setTitleError(false)
              }}
              aria-invalid={titleError}
              aria-describedby={titleError ? `${id}-title-error` : undefined}
              className={fieldClass}
            />
            {titleError && (
              <p id={`${id}-title-error`} role='alert' className='mt-1 text-sm'>
                {t('topics.titleRequired')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${id}-description`} className='font-medium'>
              {t('topics.descriptionLabel')}
            </label>
            <textarea
              id={`${id}-description`}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              aria-describedby={`${id}-description-hint`}
              className={fieldClass}
            />
            <p id={`${id}-description-hint`} className='mt-1 text-sm text-brand-700'>
              {t('topics.descriptionHint')}
            </p>
          </div>

          {failed && <p role='alert'>{t('topics.createFailed')}</p>}

          <div className='flex justify-end'>
            <Button type='submit' disabled={saving}>
              {t(saving ? 'topics.creating' : 'topics.create')}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
