import type { ReactNode } from 'react'

type IconProps = {
  children: ReactNode
  className?: string
}

export function Icon({ children, className = '' }: IconProps) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
      className={`h-4 w-4 shrink-0 ${className}`.trim()}>
      {children}
    </svg>
  )
}
