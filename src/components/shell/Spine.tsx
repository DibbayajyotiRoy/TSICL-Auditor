// Thin "where am I in the audit?" breadcrumb. Highlights the step(s) that match the current route; pages may pass `active` to override.
import { Fragment } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export const SPINE_STEPS = ['Documents', 'AI extracts', 'Audit Checks', 'Findings', 'Auditor decides', 'Board report']
// route prefix -> highlighted step indexes
const ROUTE_STEPS: [string, number[]][] = [
  ['/inbox', [0, 1]], ['/requests', [0]], ['/checks', [2]], ['/field', [2]],
  ['/procurement', [3]], ['/receivables', [3]], ['/assets', [3]],
  ['/findings/', [4]], ['/findings', [3, 4]], ['/report', [5]],
]

export default function Spine({ active, className }: { active?: number[]; className?: string }) {
  const t = useT()
  const { pathname } = useLocation()
  const on = active ?? ROUTE_STEPS.find(([p]) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))?.[1] ?? []
  const first = on[0] ?? -1
  return (
    <>
      <ol aria-label={t('Audit workflow')} className={cn('hidden flex-wrap items-center gap-x-1 gap-y-1 text-xs sm:flex', className)}>
        {SPINE_STEPS.map((s, i) => (
          <Fragment key={s}>
            {i > 0 && <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden />}
            <li aria-current={on.includes(i) ? 'step' : undefined}
              className={cn('rounded-full px-2.5 py-1 font-medium whitespace-nowrap transition-colors', on.includes(i) ? 'bg-foreground text-background' : 'text-muted-foreground')}>
              {t(s)}
            </li>
          </Fragment>
        ))}
      </ol>
      {first >= 0 && <p className={cn('text-xs text-muted-foreground sm:hidden', className)}>{t('Step')} {first + 1} / {SPINE_STEPS.length} · <span className="font-medium text-foreground">{t(SPINE_STEPS[first])}</span></p>}
    </>
  )
}
