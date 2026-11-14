import type { Role } from '@/util/roleRoute'
import { useTranslation } from 'react-i18next'

export function ParticipantsCard({
  therapistName,
  clientName,
  currentRole,
}: {
  therapistName: string
  clientName: string
  currentRole: Role
}) {
  const { t } = useTranslation()
  const participants: { role: Role; label: string; name: string }[] = [
    { role: 'therapist', label: t('connections.roles.therapist'), name: therapistName },
    { role: 'client', label: t('connections.roles.client'), name: clientName },
  ]
  return (
    <section className='flex flex-wrap gap-2 text-sm items-center'>
      {participants.map(({ role, label, name }) => {
        const isCurrent = role === currentRole
        return (
          <div
            key={role}
            className={
              isCurrent
                ? 'flex items-baseline gap-2 rounded-lg border-2 border-brand-300 bg-white px-3 py-1 shadow-sm'
                : 'flex items-baseline gap-2 rounded-lg border border-brand-200 bg-brand-100 px-3 py-1'
            }>
            <span className='text-xs font-semibold uppercase tracking-wide text-brand-700'>
              {label}
            </span>
            <span className='font-semibold text-brand-950'>{name}</span>
          </div>
        )
      })}
      <p className='ml-2 text-sm font-semibold text-brand-700'>{t('workspace.title')}</p>
    </section>
  )
}
