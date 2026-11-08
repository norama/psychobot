import type { useThemeCatalog, useWorkspaceTheme } from '@/db/theme'
import { ConnectionCard } from '@/ui/ConnectionCard'
import { HeaderDetails, HeaderMenus } from '@/ui/Layout'
import { Menu } from '@/ui/Menu'
import { ParticipantsCard } from '@/ui/ParticipantsCard'
import { ThemeSelector } from '@/ui/ThemeSelector'
import type { Workspace } from '@/util/workspaceData'
import { useTranslation } from 'react-i18next'

type ClientWorkspaceProps = {
  workspace: Workspace
  themes: ReturnType<typeof useThemeCatalog>
  themeId: ReturnType<typeof useWorkspaceTheme>['themeId']
  onChoose: ReturnType<typeof useWorkspaceTheme>['choose']
}

export function ClientWorkspace({ workspace, themes, themeId, onChoose }: ClientWorkspaceProps) {
  const { t } = useTranslation()
  return (
    <>
      <HeaderDetails>
        <ParticipantsCard
          therapistName={workspace.therapist?.display_name ?? '—'}
          clientName={workspace.client?.display_name ?? '—'}
          currentRole='client'
        />
      </HeaderDetails>
      <h1 className='mb-4'>{t('workspace.title')}</h1>
      <HeaderMenus>
        <Menu label={t('workspace.infoMenu')}>
          <ConnectionCard
            roleLabel={t('connections.roles.client')}
            counterpartLabel={t('connections.yourTherapist')}
            counterpartName={workspace.therapist?.display_name ?? '—'}
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
