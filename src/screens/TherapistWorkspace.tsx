import { WorkspaceTopics } from '@/components/WorkspaceTopics'
import type { useThemeCatalog, useWorkspaceTheme } from '@/db/theme'
import { ConnectionCard } from '@/ui/ConnectionCard'
import { HeaderDetails, HeaderMenus } from '@/ui/Layout'
import { Menu } from '@/ui/Menu'
import { ParticipantsCard } from '@/ui/ParticipantsCard'
import { ThemeSelector } from '@/ui/ThemeSelector'
import type { Workspace } from '@/util/workspaceData'
import { useTranslation } from 'react-i18next'

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
      <WorkspaceTopics />
    </>
  )
}
