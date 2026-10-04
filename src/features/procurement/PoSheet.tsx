import { useMemo, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Circle, CircleCheck } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SeverityBadge } from '@/components/kit'
import { useAudit } from '@/data/store'
import { cn, daysBetween, formatDate, formatINR } from '@/lib/utils'
import { tr, useT } from '@/lib/i18n'
import { relatedFindings, type PoRow } from './analysis'
import { IssueChip } from './parts'

type State = 'ok' | 'flag' | 'pending'
interface Step { title: string; date?: string; detail: ReactNode; state: State; note?: ReactNode }

function steps({ po, overBy }: PoRow): Step[] {
  const { grnDate: grn, paymentDate: pay } = po
  const early = !!pay && (!grn || daysBetween(grn, pay) < 0)
  const invFlag = po.invoiceAmount != null && po.invoiceAmount > po.amount
  const quotes = po.quotations <= 1
  return [
    {
      title: tr('Purchase order'), date: po.date, state: overBy > 0 || quotes ? 'flag' : 'ok',
      detail: <>{formatINR(po.amount)} {tr('approved by')} {po.approvedBy}</>,
      note: <>
        {overBy > 0 && <span className="block">{tr('Their limit is')} {formatINR(po.approverLimit)}, {tr('so this is')} {formatINR(overBy)} {tr('over')}.</span>}
        {quotes && <span className="block">{po.quotations === 0 ? tr('No quotations on file.') : tr('Only 1 quotation, so there was no price comparison.')}</span>}
      </>,
    },
    grn
      ? { title: tr('Goods received'), date: grn, state: 'ok', detail: tr('Goods receipt note recorded'), note: `${daysBetween(po.date, grn)} ${tr(daysBetween(po.date, grn) === 1 ? 'day' : 'days')} ${tr('after the order')}` }
      : { title: tr('Goods received'), state: pay ? 'flag' : 'pending', detail: tr('No goods receipt recorded yet'), note: pay ? tr('Payment was made without any record that the goods arrived.') : undefined },
    po.invoiceNo || po.invoiceAmount != null
      ? { title: tr('Invoice'), state: invFlag ? 'flag' : 'ok', detail: <>{po.invoiceNo ?? tr('Invoice')} {tr('for')} {formatINR(po.invoiceAmount ?? po.amount)}</>, note: invFlag ? `${formatINR(po.invoiceAmount! - po.amount)} ${tr('more than the order value.')}` : undefined }
      : { title: tr('Invoice'), state: 'pending', detail: tr('No invoice received yet') },
    pay
      ? {
          title: tr('Payment'), date: pay, state: early ? 'flag' : 'ok', detail: tr('Payment released'),
          note: grn ? (daysBetween(grn, pay) < 0 ? `${tr('Paid')} ${-daysBetween(grn, pay)} ${tr(-daysBetween(grn, pay) === 1 ? 'day' : 'days')} ${tr('before the goods arrived.')}` : `${daysBetween(grn, pay)} ${tr(daysBetween(grn, pay) === 1 ? 'day' : 'days')} ${tr('after goods were received')}`) : undefined,
        }
      : { title: tr('Payment'), state: 'pending', detail: tr('Not paid yet') },
  ]
}

const DOT: Record<State, { icon: typeof Circle; cls: string; word: string }> = {
  ok: { icon: CircleCheck, cls: 'text-sev-ok', word: 'Looks fine' },
  flag: { icon: AlertTriangle, cls: 'text-sev-high', word: 'Needs a look' },
  pending: { icon: Circle, cls: 'text-muted-foreground/60', word: 'Waiting' },
}

export function PoSheet({ row, onClose }: { row: PoRow | null; onClose: () => void }) {
  const t = useT()
  const last = useRef<PoRow | null>(null)
  if (row) last.current = row
  const r = row ?? last.current
  const findings = useAudit((s) => s.findings)
  const divisions = useAudit((s) => s.divisions)
  const related = useMemo(() => (r ? relatedFindings(findings, r.po.id) : []), [findings, r])

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {r && (
          <>
            <SheetHeader className="gap-1 border-b border-border p-5 pr-12">
              <SheetTitle className="font-mono text-[15px]">{r.po.id}</SheetTitle>
              <SheetDescription>{r.po.vendor} · {r.po.item}</SheetDescription>
              <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums text-foreground">{formatINR(r.po.amount)}</p>
              <p className="text-[13px] text-muted-foreground">{divisions.find((d) => d.id === r.po.divisionId)?.name ?? r.po.divisionId}</p>
              {r.issues.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{r.issues.map((i) => <IssueChip key={i} issue={i} />)}</div>}
            </SheetHeader>

            <div className="p-5">
              <h3 className="text-[13px] font-medium text-muted-foreground">{t('Purchase journey')}</h3>
              <ol className="mt-4">
                {steps(r).map((s, i, a) => {
                  const { icon: Icon, cls, word } = DOT[s.state]
                  return (
                    <li key={s.title} className="relative flex gap-3 pb-6 last:pb-0">
                      {i < a.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />}
                      <span className={cn('relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-popover', cls)}><Icon className="size-5" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{s.title}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{s.date ? formatDate(s.date) : t('No date')}</span>
                        </div>
                        <p className="text-[13px] text-foreground/80">{s.detail}</p>
                        {s.note && <div className={cn('mt-0.5 text-xs', s.state === 'flag' ? 'text-sev-high' : 'text-muted-foreground')}>{s.note}</div>}
                        <span className="sr-only">{t(word)}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <h3 className="mt-8 text-[13px] font-medium text-muted-foreground">{t('Related findings')}</h3>
              {related.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">{t('No audit finding is linked to this purchase.')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {related.map((f) => (
                    <li key={f.id}>
                      <Link to={`/findings/${f.id}`} className="group flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <SeverityBadge severity={f.severity} />
                          <p className="mt-1.5 text-sm font-medium text-foreground">{f.title}</p>
                          <p className="text-xs text-muted-foreground">{f.reason}</p>
                        </div>
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
