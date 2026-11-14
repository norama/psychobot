import { Link } from 'react-router'
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
        <Link className='mt-4 inline-block text-brand-700 underline' to={openHref}>
          {t('connections.openWorkspace')}
        </Link>
      )}
    </section>
  )
}
