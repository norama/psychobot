import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ThemeCategory = 'signed_out' | 'signed_in' | 'workspace'
export type ThemeRole = 'therapist' | 'client'

export type Theme = {
  id: string
  category: ThemeCategory
  hue: number
  saturation: number
  default_for_role: ThemeRole | null
}

function applyTheme(theme: Pick<Theme, 'hue' | 'saturation'>) {
  const root = document.documentElement.style
  root.setProperty('--brand-h', String(theme.hue))
  root.setProperty('--brand-s', `${theme.saturation}%`)
}

// Fetches the small, shared theme catalog once. Open to read for every
// session (even signed out), so no auth dependency here.
export function useThemeCatalog(db: SupabaseClient) {
  const [themes, setThemes] = useState<Theme[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    db.from('themes')
      .select('id, category, hue, saturation, default_for_role')
      .abortSignal(controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted && data) setThemes(data as Theme[])
      })
    return () => controller.abort()
  }, [db])

  return themes
}

// Applies the single fixed theme for signed_out/signed_in. Pass category
// as null to opt out (used when a specific workspace view owns theming
// instead).
export function useFixedTheme(themes: Theme[] | null, category: ThemeCategory | null) {
  useEffect(() => {
    if (!themes || !category) return
    const theme = themes.find((candidate) => candidate.category === category)
    if (theme) applyTheme(theme)
  }, [themes, category])
}

// Applies the viewer's saved theme for one workspace, or their role's
// default when nothing is saved yet. Pass workspaceId as '' to opt out
// (no valid single workspace in view right now).
export function useWorkspaceTheme(
  db: SupabaseClient,
  themes: Theme[] | null,
  userId: string,
  workspaceId: string,
  role: ThemeRole,
) {
  // undefined: not loaded yet, so skip applying anything until the real
  // value is known (nothing to show but avoids a default-then-saved flash).
  const [themeId, setThemeId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!workspaceId) return
    const controller = new AbortController()
    db.from('workspace_theme_preferences')
      .select('theme_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .abortSignal(controller.signal)
      .maybeSingle()
      .then(({ data }: { data: { theme_id: string } | null }) => {
        if (!controller.signal.aborted) setThemeId(data?.theme_id ?? null)
      })
    return () => controller.abort()
  }, [db, userId, workspaceId])

  useEffect(() => {
    if (!themes || !workspaceId || themeId === undefined) return
    const active = themeId
      ? themes.find((candidate) => candidate.id === themeId)
      : themes.find((candidate) => candidate.category === 'workspace' && candidate.default_for_role === role)
    if (active) applyTheme(active)
  }, [themes, workspaceId, themeId, role])

  async function choose(nextThemeId: string) {
    setThemeId(nextThemeId)
    await db.from('workspace_theme_preferences')
      .upsert({ user_id: userId, workspace_id: workspaceId, theme_id: nextThemeId })
  }

  return { themeId, choose }
}
