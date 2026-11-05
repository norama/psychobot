import type { ReactNode } from 'react'

export function Layout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50 text-brand-950">
      <div className="mx-auto w-[min(100%-2rem,42rem)] py-8">
        <header className="mb-4 flex items-center justify-between gap-4">
          <a className="font-bold text-brand-900 no-underline" href="/">PsychoBot</a>
          {actions}
        </header>
        <main className="rounded-2xl border border-brand-200 bg-white p-6 sm:p-10">
          <p className="m-0 text-sm font-semibold text-brand-700">Testovací prostředí</p>
          {children}
        </main>
      </div>
    </div>
  )
}
