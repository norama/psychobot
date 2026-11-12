import { Button } from '@/ui/Button'
import type { Role } from '@/util/roleRoute'
import { isInvitationRoute } from '@/util/roleRoute'
import { useTranslation } from 'react-i18next'

type LoggedOutScreenProps = {
  role: Role
  busy: boolean
  onChooseRole: (role: Role) => void
  onSignIn: () => void
}

export function LoggedOutScreen({ role, busy, onChooseRole, onSignIn }: LoggedOutScreenProps) {
  const { t } = useTranslation()
  return (
    <>
      <h1>{isInvitationRoute ? t('auth.signedOutInviteTitle') : t('auth.signedOutTitle')}</h1>
      <p>{isInvitationRoute ? t('auth.signedOutInviteText') : t('auth.signedOutText')}</p>
      <div className='mt-4 flex flex-wrap items-center justify-between gap-4'>
        <div
          role='radiogroup'
          aria-label={t('auth.roleSwitchLabel')}
          className='inline-flex rounded-full border border-brand-300 bg-white p-1'>
          {(['therapist', 'client'] as const).map((option) => (
            <button
              key={option}
              type='button'
              role='radio'
              aria-checked={option === role}
              disabled={busy || isInvitationRoute}
              onClick={() => onChooseRole(option)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-65 ${
                option === role ? 'bg-brand-100 text-brand-800' : 'text-brand-600 hover:bg-brand-50'
              }`}>
              {t(`connections.roles.${option}`)}
            </button>
          ))}
        </div>
        <Button disabled={busy} onClick={onSignIn}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </div>
    </>
  )
}
