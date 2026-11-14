import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

type HeaderSlots = { menus: HTMLElement | null; details: HTMLElement | null }

const HeaderSlotContext = createContext<HeaderSlots>({ menus: null, details: null })

// Renders its children into the header row, before the account actions.
export function HeaderMenus({ children }: { children: ReactNode }) {
  const { menus } = useContext(HeaderSlotContext)
  return menus ? createPortal(children, menus) : null
}

// Renders its children into the second header row, under the menus.
export function HeaderDetails({ children }: { children: ReactNode }) {
  const { details } = useContext(HeaderSlotContext)
  return details ? createPortal(children, details) : null
}

export function Layout({
  children,
  actions,
  roleLabel,
  narrow = true,
}: {
  children: ReactNode
  actions?: ReactNode
  roleLabel?: string
  // Workspace screens (with their chat) need the full available width;
  // every other screen stays narrow and readable.
  narrow?: boolean
}) {
  const { t } = useTranslation()
  const [menus, setMenus] = useState<HTMLDivElement | null>(null)
  const [details, setDetails] = useState<HTMLDivElement | null>(null)
  return (
    <HeaderSlotContext.Provider value={{ menus, details }}>
      <div className='min-h-screen bg-brand-50 text-brand-950'>
        <div className={`mx-auto w-[calc(100%-2rem)] py-8 ${narrow ? 'max-w-[42rem]' : ''}`}>
          <header className='sticky top-0 z-20 mb-4 bg-brand-50 py-4'>
            <div className='flex items-center justify-between gap-4'>
              <Link className='font-bold text-brand-900 no-underline' to='/'>
                {t('app.name')}
                {roleLabel && ` - ${roleLabel}`}
              </Link>
              <div className='ml-auto flex items-center gap-2'>
                <div ref={setMenus} className='flex items-center gap-2' />
                {actions}
              </div>
            </div>
            <div ref={setDetails} className='mt-3' />
          </header>
          <main
            className={`overflow-hidden rounded-2xl border border-brand-200 bg-white ${
              narrow ? 'p-6 sm:p-10' : ''
            }`}>
            {children}
          </main>
        </div>
      </div>
    </HeaderSlotContext.Provider>
  )
}
