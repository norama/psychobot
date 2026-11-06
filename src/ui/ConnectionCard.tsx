import { useTranslation } from 'react-i18next'

export function ConnectionCard({
  roleLabel,
  counterpartLabel,
  counterpartName,
  openHref,
}: {
  roleLabel?: string
  counterpartLabel?: string
  counterpartName: string
  openHref?: string
}) {
  const { t } = useTranslation()
  return (
    <section className='connection' aria-label={t('connections.cardLabel')}>
      <dl>
        {roleLabel && (
          <div>
            <dt>{t('connections.yourRole')}</dt>
            <dd>{roleLabel}</dd>
          </div>
        )}
        <div>
          {counterpartLabel && <dt>{counterpartLabel}</dt>}
          <dd>{counterpartName}</dd>
        </div>
      </dl>
      {openHref && (
        <a className='mt-4 inline-block text-brand-700 underline' href={openHref}>
          {t('connections.openWorkspace')}
        </a>
      )}
    </section>
  )
}
