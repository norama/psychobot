import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function Menu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const details = ref.current
      if (details?.open && !details.contains(event.target as Node)) details.open = false
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  return (
    <details ref={ref} className='relative'>
      <summary className='cursor-pointer list-none rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-900'>
        {label}
      </summary>
      <div className='absolute right-0 z-10 mt-2 flex min-w-[14rem] flex-col gap-3 rounded-xl border border-brand-200 bg-white p-4 shadow-lg'>
        {children}
      </div>
    </details>
  )
}
