import type { ReactNode } from 'react'

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className='inline-flex h-5 shrink-0 items-center rounded-full bg-brand-100 px-2 text-xs font-semibold leading-none text-brand-800'>
      {children}
    </span>
  )
}
