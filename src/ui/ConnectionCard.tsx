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
  return (
    <section className='connection' aria-label='Propojení'>
      <dl>
        {roleLabel && (
          <div>
            <dt>Vaše role</dt>
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
          Otevřít pracovní prostor
        </a>
      )}
    </section>
  )
}
