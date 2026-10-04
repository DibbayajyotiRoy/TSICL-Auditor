import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NumberTicker } from '@/components/ui/number-ticker'
import { useAudit } from '@/data/store'
import type { Area } from '@/data/types'
import { cn } from '@/lib/utils'
import { tr, useT } from '@/lib/i18n'
import { AREA_ORDER } from './areas'

const pl = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${tr(n === 1 ? one : many)}`

interface Step { label: string; checks: number }

/** One step per audit area that has an active check. Record counts come straight from the store. */
function buildSteps(): Step[] {
  const s = useAudit.getState()
  const docs = (kind?: string) => s.documents.filter((d) => !kind || d.kind === kind).length
  const records = s.purchaseOrders.length + s.receivables.length + s.assets.length
  const label: Record<Area, [number, (n: number) => string, string]> = {
    procurement: [s.purchaseOrders.length, (n) => `${tr('Checking')} ${pl(n, 'purchase', 'purchases')}`, tr('Checking purchases')],
    scrap: [docs('scrap_auction'), (n) => `${tr('Reviewing')} ${pl(n, 'scrap auction record', 'scrap auction records')}`, tr('Reviewing scrap and surplus sales')],
    receivables: [s.receivables.length, (n) => `${tr('Reviewing')} ${pl(n, 'customer invoice', 'customer invoices')}`, tr('Reviewing customer invoices')],
    cash_bank: [s.bankReceipts.length, (n) => `${tr('Matching')} ${pl(n, 'bank receipt', 'bank receipts')}`, tr('Matching bank receipts')],
    fixed_assets: [s.assets.length, (n) => `${tr('Verifying')} ${pl(n, 'asset', 'assets')}`, tr('Verifying assets')],
    establishment: [docs(), (n) => `${tr('Reading')} ${pl(n, 'staff and office document', 'staff and office documents')}`, tr('Reading staff and office documents')],
    compliance: [docs(), (n) => `${tr('Testing')} ${pl(n, 'document', 'documents')} ${tr('for statutory compliance')}`, tr('Testing statutory compliance')],
    internal_controls: [s.purchaseOrders.length, (n) => `${tr('Tracing')} ${pl(n, 'approval trail', 'approval trails')}`, tr('Tracing approval trails')],
    cag: [records, (n) => `${tr('Screening')} ${pl(n, 'record', 'records')} ${tr('against CAG themes')}`, tr('Screening records against CAG themes')],
  }
  return AREA_ORDER.flatMap((a) => {
    const rules = s.rules.filter((r) => r.area === a && r.enabled).length
    if (!rules) return []
    const [n, text, generic] = label[a]
    return [{ label: n ? text(n) : generic, checks: Math.max(n, 1) * rules }]
  })
}

function RunPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const reduce = useReducedMotion()
  const [steps] = useState(buildSteps)
  const [done, setDone] = useState(0)
  const [result, setResult] = useState<{ total: number; urgent: number; ran: number } | null>(null)
  const checks = steps.slice(0, done).reduce((a, x) => a + x.checks, 0)

  useEffect(() => {
    if (result) return
    const stepMs = reduce ? 120 : Math.max(400, 4000 / Math.max(steps.length, 1))
    const t = setTimeout(() => {
      if (done < steps.length) return setDone(done + 1)
      useAudit.getState().rerunAudit()
      const { findings, rules } = useAudit.getState()
      setResult({ total: findings.length, urgent: findings.filter((f) => f.severity === 'critical').length, ran: rules.filter((r) => r.enabled).length })
    }, done < steps.length ? stepMs : reduce ? 100 : 500)
    return () => clearTimeout(t)
  }, [done, result, reduce, steps.length])

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold tracking-tight">{result ? t('Audit complete') : t('Running full audit…')}</DialogTitle>
        <DialogDescription>{result ? `${t('Ran')} ${pl(result.ran, 'check', 'checks')} ${t('across every record.')}` : t('Going through every record, area by area.')}</DialogDescription>
      </DialogHeader>

      <ol className="space-y-0.5" aria-live="polite">
        {steps.map((s, i) => {
          const state = i < done ? 'done' : i === done && !result ? 'active' : 'pending'
          return (
            <li key={s.label} className={cn('flex min-h-9 items-center gap-3 rounded-lg px-2 text-[14px] transition-opacity duration-200', state === 'pending' && 'opacity-40')}>
              <span className="grid size-5 shrink-0 place-items-center">
                {state === 'done' ? <Check className="size-4 text-sev-ok" aria-hidden />
                  : state === 'active' ? <Loader2 className="size-4 text-muted-foreground motion-safe:animate-spin" aria-hidden />
                  : <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
              </span>
              <span className="min-w-0 flex-1 text-pretty">{s.label}{state === 'done' ? ' ✓' : '…'}</span>
            </li>
          )
        })}
      </ol>

      <div>
        <div className="flex items-baseline gap-2">
          {reduce
            ? <span className="text-4xl font-semibold tracking-tight tabular-nums">{checks.toLocaleString('en-IN')}</span>
            : <NumberTicker value={checks} className="text-4xl font-semibold tracking-tight" />}
          <span className="text-sm text-muted-foreground">{checks === 1 ? t('check') : t('checks')} {t('completed')}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
          <div className="h-full origin-left rounded-full bg-foreground transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${steps.length ? done / steps.length : 1})` }} />
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {result.total === 0 ? t('No issues found') : <>{result.total} {result.total === 1 ? t('issue') : t('issues')} {t('found')} · {result.urgent} {t('Urgent')}</>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t('AI drafts. You decide on every one.')}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="lg" className="h-11 flex-1"><Link to="/findings" onClick={onClose}>{t('Review the findings')}</Link></Button>
            <Button variant="outline" size="lg" className="h-11 px-4" onClick={onClose}>{t('Close')}</Button>
          </div>
        </div>
      )}
    </>
  )
}

export function RunAudit({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <RunPanel onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
