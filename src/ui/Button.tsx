import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet'
}

const base =
  'cursor-pointer rounded-lg border px-4 py-2 disabled:cursor-default disabled:opacity-65'
const variants = {
  primary: 'border-brand-700 bg-brand-700 text-white enabled:hover:bg-brand-800',
  secondary: 'border-brand-700 bg-white text-brand-800 enabled:hover:bg-brand-50',
  quiet:
    'border-transparent bg-brand-200 text-brand-800 enabled:hover:bg-brand-300 hover:bg-brand-300',
}

export function buttonClassName(
  variant: NonNullable<ButtonProps['variant']> = 'primary',
  className = '',
) {
  return `${base} ${variants[variant]} ${className}`.trim()
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClassName(variant, className)} {...props} />
}
