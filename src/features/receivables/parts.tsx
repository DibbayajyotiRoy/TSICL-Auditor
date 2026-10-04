import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'

/** Section heading: plain-language title, technical term muted beside it, optional right-hand control. */
export function SectionHead({ title, term, children }: { title: string; term?: string; children?: ReactNode }) {
  const t = useT()
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t(title)}</h2>
        {term && <p className="text-[13px] text-muted-foreground">{t(term)}</p>}
      </div>
      {children}
    </div>
  )
}
