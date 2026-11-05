import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

const base = 'cursor-pointer rounded-lg border px-4 py-2 disabled:cursor-wait disabled:opacity-65'
const variants = {
  primary: 'border-brand-700 bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'border-brand-700 bg-white text-brand-800 hover:bg-brand-50',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${className}`.trim()} {...props} />
}
