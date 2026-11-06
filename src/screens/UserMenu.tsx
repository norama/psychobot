import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { Button } from '@/ui/Button'
import { Menu } from '@/ui/Menu'
import type { Role } from '@/screens/roleRoute'

type UserMenuProps = {
  db: SupabaseClient
  userId: string
  role: Role
  busy: boolean
  onSignOut: () => void
}

export function UserMenu({ db, userId, role, busy, onSignOut }: UserMenuProps) {
  const { t } = useTranslation()
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await db
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle()
      if (active) setName(data?.display_name ?? null)
    }
    void load()
    return () => {
      active = false
    }
  }, [db, userId])

  return (
    <Menu label={t('user.menuLabel')}>
      <div>
        <p className='m-0 font-semibold'>{name ?? '—'}</p>
        <p className='m-0 text-sm text-brand-700'>
          {t('connections.yourRole')}: {t(`connections.roles.${role}`)}
        </p>
      </div>
      <Button variant='secondary' disabled={busy} onClick={onSignOut}>
        {t('auth.signOut')}
      </Button>
    </Menu>
  )
}
