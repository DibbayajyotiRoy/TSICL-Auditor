import { motion, useReducedMotion } from 'motion/react'
import { EmptyState } from '@/components/kit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { BUCKETS, inL } from './logic'

type Row = { amount: number; count: number }

/** One 24px stacked bar (how the money splits by age) + four legend tiles that carry the exact values.
 *  Every segment and tile is a filter button. Calm blue -> alarming red; only "over 180 days" is critical. */
export function AgeingChart({ rows, bucket, onBucket }: { rows: Row[]; bucket: number | null; onBucket: (b: number | null) => void }) {
  const t = useT()
  const reduce = useReducedMotion()
  const total = rows.reduce((s, r) => s + r.amount, 0)
  if (!total) return <EmptyState title={t('No outstanding balances')} body={t('Once customer balances are loaded, you will see how old they are here.')} />
  const shown = rows.map((r, i) => ({ ...r, i })).filter((r) => r.amount > 0)
  const toggle = (i: number) => onBucket(bucket === i ? null : i)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* stacked bar: 2px surface gaps, 4px round outer ends, square inside */}
      <motion.div
        className="flex h-6 gap-0.5"
        role="group" aria-label={t('Money owed by age')}
        initial={reduce ? false : { clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {shown.map((r, k) => (
          <Tooltip key={r.i}>
            <TooltipTrigger asChild>
              <button
                type="button" onClick={() => toggle(r.i)} aria-pressed={bucket === r.i}
                aria-label={`${t(BUCKETS[r.i].label)}: ${inL(r.amount)}, ${r.count} ${r.count === 1 ? t('invoice') : t('invoices')}`}
                style={{ flexGrow: r.amount, flexBasis: 0, minWidth: 6 }}
                className={cn('h-full outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-ring',
                  BUCKETS[r.i].bar, k === 0 && 'rounded-l', k === shown.length - 1 && 'rounded-r',
                  bucket !== null && bucket !== r.i ? 'opacity-30' : 'hover:opacity-85')}
              />
            </TooltipTrigger>
            <TooltipContent><span className="font-semibold tabular-nums">{inL(r.amount)}</span> · {t(BUCKETS[r.i].label)} · {r.count} {r.count === 1 ? t('invoice') : t('invoices')}</TooltipContent>
          </Tooltip>
        ))}
      </motion.div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BUCKETS.map((b, i) => {
          const r = rows[i]
          const on = bucket === i
          return (
            <button
              key={b.label} type="button" disabled={!r.count} onClick={() => toggle(i)} aria-pressed={on}
              className={cn('min-h-[88px] rounded-xl border p-3 text-left transition-[border-color,background-color,opacity] duration-200 disabled:cursor-default disabled:opacity-50',
                on ? 'border-foreground/25 bg-muted/60' : 'border-transparent enabled:hover:bg-muted/40',
                bucket !== null && !on && 'opacity-60')}
            >
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span className={cn('size-2 rounded-full', b.bar)} aria-hidden />
                {t(b.label)}
              </span>
              <span className={cn('mt-1.5 block text-xl font-semibold tabular-nums tracking-tight', i === 3 && r.amount > 0 ? 'text-sev-critical' : 'text-foreground')}>{inL(r.amount)}</span>
              <span className="mt-0.5 block text-[13px] tabular-nums text-muted-foreground">
                {r.count} {r.count === 1 ? t('invoice') : t('invoices')} · {Math.round((r.amount / total) * 100)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
