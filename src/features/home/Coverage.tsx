import { useEffect, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import { useT } from '@/lib/i18n'
import type { FinancialYear } from '@/data/types'

const DONE: FinancialYear[] = ['FY 2024-25', 'FY 2025-26']

/** The engagement covers three financial years; the first two are complete, the current one is in progress. */
export function Coverage({ progress }: { progress: number }) {
  const t = useT()
  // ring fills in once after mount (CSS only transitions on change)
  const [ring, setRing] = useState(0)
  useEffect(() => { const id = setTimeout(() => setRing(progress), 250); return () => clearTimeout(id) }, [progress])

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{t('Audit coverage')}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{t('All three financial years are in scope.')}</p>
      <ul className="mt-3 divide-y divide-border">
        {DONE.map((fy) => (
          <li key={fy} className="flex min-h-12 items-center justify-between gap-3 text-[14px]">
            <span className="font-medium text-foreground">{fy}</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"><CircleCheck className="size-4 text-sev-ok" aria-hidden />{t('Completed')}</span>
          </li>
        ))}
        <li className="flex min-h-14 items-center justify-between gap-3 text-[14px]">
          <span className="font-medium text-foreground">FY 2026-27</span>
          <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <AnimatedCircularProgressBar value={ring} gaugePrimaryColor="var(--foreground)" gaugeSecondaryColor="var(--border)" className="size-9 text-[11px] font-semibold tabular-nums text-foreground" />
            {t('In progress')} · {progress}% {t('complete')}
          </span>
        </li>
      </ul>
    </section>
  )
}
