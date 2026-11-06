import type { useThemeCatalog, useWorkspaceTheme } from '@/theme'
import { useTranslation } from 'react-i18next'
import { HeaderDetails, HeaderMenus } from '@/ui/Layout'
import { Menu } from '@/ui/Menu'
import { ParticipantsCard } from '@/ui/ParticipantsCard'
import { ThemeSelector } from '@/ui/ThemeSelector'
import type { Workspace } from '@/screens/workspaceData'
import { ConnectionCard } from '@/ui/ConnectionCard'

type TherapistWorkspaceProps = {
  workspace: Workspace
  themes: ReturnType<typeof useThemeCatalog>
  themeId: ReturnType<typeof useWorkspaceTheme>['themeId']
  onChoose: ReturnType<typeof useWorkspaceTheme>['choose']
}

export function TherapistWorkspace({
  workspace,
  themes,
  themeId,
  onChoose,
}: TherapistWorkspaceProps) {
  const { t } = useTranslation()
  return (
    <>
      <HeaderDetails>
        <ParticipantsCard
          therapistName={workspace.therapist?.display_name ?? '—'}
          clientName={workspace.client?.display_name ?? '—'}
          currentRole='therapist'
        />
      </HeaderDetails>
      <h1 className='mb-4'>{t('workspace.title')}</h1>
      <HeaderMenus>
        <Menu label={t('workspace.infoMenu')}>
          <ConnectionCard
            roleLabel={t('connections.roles.therapist')}
            counterpartLabel={t('connections.yourClient')}
            counterpartName={workspace.client?.display_name ?? '—'}
          />
        </Menu>
        {themes && (
          <Menu label={t('theme.groupLabel')}>
            <ThemeSelector themes={themes} activeThemeId={themeId} onChoose={onChoose} />
          </Menu>
        )}
      </HeaderMenus>
      <p>{t('workspace.messagesComingSoon')}</p>
    </>
  )
}
