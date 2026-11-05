import type { ReactNode } from 'react'

export function ConnectionSection({
  title,
  emptyText,
  actions,
  children,
}: {
  title: string
  emptyText: string
  actions?: ReactNode
  children: ReactNode[]
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-brand-900">{title}</h2>
        {actions}
      </div>
      {children.length === 0 ? <p className="mt-2 text-brand-700">{emptyText}</p> : children}
    </section>
  )
}
