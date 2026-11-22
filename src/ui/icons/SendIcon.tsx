import { Icon } from '@/ui/Icon'

export function SendIcon({ className = '' }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d='m22 2-7 20-4-9-9-4 20-7Z' />
      <path d='M22 2 11 13' />
    </Icon>
  )
}
