import { useTranslation } from 'react-i18next'
import type { Theme } from '@/db/theme'

export function ThemeSelector({
  themes,
  activeThemeId,
  onChoose,
}: {
  themes: Theme[]
  activeThemeId: string | null | undefined
  onChoose: (themeId: string) => void
}) {
  const { t } = useTranslation()
  const options = themes.filter((theme) => theme.category === 'workspace')

  return (
    <div role='radiogroup' aria-label={t('theme.groupLabel')} className='flex gap-3'>
      {options.map((theme) => (
        <button
          key={theme.id}
          type='button'
          role='radio'
          aria-checked={theme.id === activeThemeId}
          aria-label={t(`theme.colors.${theme.id}`, { defaultValue: theme.id })}
          onClick={() => onChoose(theme.id)}
          className={`h-8 w-8 cursor-pointer rounded-full border-2 ${
            theme.id === activeThemeId ? 'border-gray-900' : 'border-transparent'
          }`}
          style={{ backgroundColor: `hsl(${theme.hue} ${theme.saturation}% 55%)` }}
        />
      ))}
    </div>
  )
}
