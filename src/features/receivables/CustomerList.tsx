import { useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { EmptyState, SeverityBadge } from '@/components/kit'
import type { Division, Receivable } from '@/data/types'
import { cn, formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { BUCKETS, ageInfo, monthsText, sinceText } from './logic'
import { SectionHead } from './parts'

const SORTS = [['amount', 'Biggest amount'], ['age', 'Longest overdue']] as const
const FIRST = 8

/** Four ascending bars (signal-strength style): how far up the age ladder this balance has climbed. */
function AgeBars({ bucket }: { bucket: number }) {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {BUCKETS.map((b, i) => (
        <span key={b.label} style={{ height: 6 + i * 3.3 }} className={cn('w-1 rounded-[2px]', i <= bucket ? b.bar : 'bg-muted-foreground/20')} />
      ))}
    </span>
  )
}

export function CustomerList({ recs, divisions, today, bucket, onClear }: {
  recs: Receivable[]; divisions: Division[]; today: string; bucket: number | null; onClear: () => void
}) {
  const t = useT()
  const reduce = useReducedMotion()
  const pill = useId()
  const [sort, setSort] = useState<'amount' | 'age'>('amount')
  const [all, setAll] = useState(false)

  const rows = useMemo(() => {
    const div = new Map(divisions.map((d) => [d.id, d.name]))
    return recs
      .filter((r) => r.amount > 0)
      .map((r) => ({ r, age: ageInfo(r, today), division: div.get(r.divisionId) ?? '' }))
      .filter((x) => bucket === null || x.age.bucket === bucket)
      .sort((a, b) => (sort === 'amount' ? b.r.amount - a.r.amount : b.age.days - a.age.days))
  }, [recs, divisions, today, bucket, sort])
  const list = all ? rows : rows.slice(0, FIRST)

  return (
    <section id="owed-list" className="scroll-mt-6">
      <SectionHead title="Who owes us money" term="Trade receivables, by customer invoice">
        <div role="group" aria-label={t('Sort by')} className="relative flex rounded-lg bg-muted p-0.5">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k}
              className={cn('relative h-9 rounded-md px-3 text-[13px] font-medium transition-colors', sort === k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {sort === k && <motion.span layoutId={pill} className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="relative">{t(label)}</span>
            </button>
          ))}
        </div>
      </SectionHead>

      {bucket !== null && (
        <div className="mb-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          {t('Showing')} <span className="font-medium text-foreground">{t(BUCKETS[bucket].label)}</span> · {rows.length}
          <button type="button" onClick={onClear} className="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-foreground hover:bg-muted">
            <X className="size-3.5" aria-hidden />{t('Show all')}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={t(recs.length ? 'Nothing in this age group' : 'No customer balances yet')} body={t(recs.length ? 'Pick another age group above, or show everything.' : 'Balances will appear here once the ledger is loaded.')} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {list.map(({ r, age, division }, i) => (
              <motion.li
                key={r.id} layout={!reduce ? 'position' : false}
                initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.25, ease: 'easeOut', layout: { type: 'spring', stiffness: 500, damping: 40 } }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,2fr)_9rem_minmax(0,1.6fr)_12rem] md:px-5"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[15px] leading-snug font-medium text-foreground md:truncate">{r.customer}</p>
                  <p className="text-[13px] leading-snug text-muted-foreground md:truncate">{[division, r.invoiceNo].filter(Boolean).join(' · ')}</p>
                </div>
                <p className="text-right text-[15px] font-semibold tabular-nums text-foreground">{formatINR(r.amount)}</p>
                <div className="min-w-0 text-[13px]">
                  <p className="text-foreground/90">{sinceText(age)}</p>
                  {monthsText(age.days) && <p className="text-muted-foreground">{monthsText(age.days)}</p>}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <AgeBars bucket={age.bucket} />
                  <SeverityBadge severity={BUCKETS[age.bucket].sev} />
                </div>
              </motion.li>
            ))}
          </ul>
          {rows.length > FIRST && (
            <button type="button" onClick={() => setAll((v) => !v)} className="h-11 w-full border-t border-border text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
              {all ? t('Show fewer') : `${t('Show all')} ${rows.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
