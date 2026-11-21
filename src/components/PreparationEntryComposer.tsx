import { Button } from '@/ui/Button'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

type PreparationEntryComposerProps = {
  initialValue?: {
    title: string | null
    content: string
  }
  onSave: (input: { title: string | null; content: string }) => Promise<void>
  onStateChange: (state: { dirty: boolean; saving: boolean }) => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function PreparationEntryComposer({
  initialValue,
  onSave,
  onStateChange,
  onCancel,
  mode = 'create',
}: PreparationEntryComposerProps) {
  const { t } = useTranslation()
  const id = useId()
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [content, setContent] = useState(initialValue?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [initialFields] = useState(() => ({
    title: initialValue?.title ?? '',
    content: initialValue?.content ?? '',
  }))

  const dirty =
    mode === 'edit'
      ? title !== initialFields.title || content !== initialFields.content
      : title !== '' || content !== ''

  useEffect(() => {
    onStateChange({ dirty, saving })
  }, [dirty, saving, onStateChange])

  useEffect(() => {
    if (!dirty && !saving) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty, saving])

  async function handleSave() {
    if (saving || !content.trim()) return

    setSaving(true)
    setFailed(false)

    try {
      await onSave({
        title: title.trim() || null,
        content: content.trim(),
      })

      setTitle('')
      setContent('')
    } catch (error) {
      console.error('Failed to save preparation entry', error)
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'mt-1 block w-full rounded-lg border border-brand-300 bg-white px-3 py-2'

  return (
    <form
      className='mt-6'
      onSubmit={(event) => {
        event.preventDefault()
        void handleSave()
      }}>
      <fieldset disabled={saving} className='space-y-3'>
        <div>
          <label htmlFor={`${id}-title`} className='text-sm font-medium'>
            {t('messages.entryTitle')}
          </label>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`${id}-content`} className='text-sm font-medium'>
            {t('messages.entryContent')}
          </label>
          <textarea
            id={`${id}-content`}
            rows={4}
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className={fieldClass}
          />
        </div>

        {failed && (
          <p role='alert' className='text-sm'>
            {t('messages.saveFailed')}
          </p>
        )}

        <div className='flex justify-end gap-2'>
          {onCancel && (
            <Button type='button' variant='secondary' onClick={onCancel}>
              {t('messages.cancel')}
            </Button>
          )}

          <Button type='submit' disabled={saving || !content.trim()}>
            {t(saving ? 'messages.saving' : 'messages.save')}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
