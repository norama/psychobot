import { Link, type LinkProps } from 'react-router'

export function AppLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-900 hover:decoration-brand-700 ${className}`.trim()}
      {...props}
    />
  )
}
