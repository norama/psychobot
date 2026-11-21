import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

type DialogProps = {
  title: string
  children: ReactNode
  onClose: () => void
  dismissible?: boolean
  showCloseButton?: boolean
}

export function Dialog({
  title,
  children,
  onClose,
  dismissible = true,
  showCloseButton = true,
}: DialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-brand-200 bg-white p-6 text-brand-950 shadow-xl backdrop:bg-black/40'>
      <div className='mb-6 flex items-start justify-between gap-4'>
        <h2 id={titleId} className='text-xl font-semibold'>
          {title}
        </h2>

        {showCloseButton && (
          <Button type='button' variant='secondary' disabled={!dismissible} onClick={onClose}>
            {t('common.close')}
          </Button>
        )}
      </div>

      {children}
    </dialog>
  )
}
