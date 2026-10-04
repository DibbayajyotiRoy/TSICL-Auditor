import { useMemo, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { EmptyState } from '@/components/kit'
import { useAudit } from '@/data/store'
import { cn, formatDate, formatINR, formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { SectionHead } from './parts'

const FIRST = 6

/** Cash & bank reconciliation: every rupee in the bank statement is either credited to a customer or still waiting. */
export function BankReconciliation() {
  const t = useT()
  const receipts = useAudit((s) => s.bankReceipts)
  const recs = useAudit((s) => s.receivables)
  const [all, setAll] = useState(false)

  const { total, matched, pct, rows } = useMemo(() => {
    const total = receipts.reduce((s, r) => s + r.amount, 0)
    const matched = receipts.filter((r) => r.matchedReceivableId).reduce((s, r) => s + r.amount, 0)
    return { total, matched, pct: total ? Math.round((matched / total) * 100) : 0, rows: [...receipts].sort((a, b) => b.date.localeCompare(a.date)) }
  }, [receipts])
  const byId = useMemo(() => new Map(recs.map((r) => [r.id, r])), [recs])

  return (
    <section>
      <SectionHead title="Cash & bank check" term="Bank reconciliation: does the bank statement agree with our books?" />
      {receipts.length === 0 ? (
        <EmptyState title={t('No bank receipts yet')} body={t('Upload a bank statement in the Document Inbox and receipts will be listed here.')} />
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <div className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-medium text-foreground"><span className="tabular-nums">{pct}%</span> {t('of money received is credited to customers')}</p>
              <p className="text-[13px] tabular-nums text-muted-foreground">{formatINRShort(total)} {t('received in total')}</p>
            </div>
            <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${pct}% ${t('matched')}`}>
              {matched > 0 && <span className="h-full rounded-full bg-sev-ok transition-[flex-grow] duration-500" style={{ flexGrow: matched, flexBasis: 0 }} />}
              {total - matched > 0 && <span className="h-full rounded-full bg-sev-high transition-[flex-grow] duration-500" style={{ flexGrow: total - matched, flexBasis: 0 }} />}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <dt className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-sev-ok" aria-hidden />{t('Credited to customers')}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatINR(matched)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-sev-high" aria-hidden />{t('Not yet credited')}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatINR(total - matched)}</dd>
              </div>
            </dl>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {(all ? rows : rows.slice(0, FIRST)).map((rc) => {
              const to = rc.matchedReceivableId ? byId.get(rc.matchedReceivableId) : undefined
              const done = !!rc.matchedReceivableId
              return (
                <li key={rc.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[6.5rem_minmax(0,1fr)_8rem_13rem]">
                  <span className="text-[13px] text-muted-foreground max-md:col-span-2">{formatDate(rc.date)}</span>
                  <span className="truncate font-mono text-xs text-foreground/80" title={rc.narration}>{rc.narration}</span>
                  <span className="text-right text-[14px] font-medium tabular-nums text-foreground">{formatINR(rc.amount)}</span>
                  <span className={cn('col-span-2 flex items-center gap-1.5 text-[13px] md:col-span-1', done ? 'text-sev-ok' : 'text-sev-high')}>
                    {done ? <CheckCircle2 className="size-4 shrink-0" aria-hidden /> : <Clock className="size-4 shrink-0" aria-hidden />}
                    <span className="truncate">{done ? `${t('Credited to')} ${to?.customer ?? t('a customer')}` : t('Waiting to be matched')}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          {rows.length > FIRST && (
            <button type="button" onClick={() => setAll((v) => !v)} className="h-11 w-full rounded-b-2xl border-t border-border text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
              {all ? t('Show fewer') : `${t('Show all')} ${rows.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
