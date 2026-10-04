import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Landmark, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Confidence, EmptyState, EvidenceChip } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { DotLoader } from '@/components/ui/dot-loader'
import { useAudit } from '@/data/store'
import type { BankReceipt } from '@/data/types'
import { formatDate, formatINR } from '@/lib/utils'
import { play } from '@/lib/sound'
import { useT, tr } from '@/lib/i18n'
import { useUI } from '@/lib/ui'
import { suggestMatch, type Suggestion } from './logic'
import { SectionHead } from './parts'

// 7x7 grid, a column sweeping left to right.
const WAVE = Array.from({ length: 7 }, (_, c) => Array.from({ length: 7 }, (_, r) => r * 7 + c))
let scannedOnce = false // "Finding a match…" shows on first view only

function Scanning() {
  const t = useT()
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ai/20 bg-ai/[0.04] p-5" role="status">
      <DotLoader frames={WAVE} duration={90} dotClassName="bg-muted-foreground/20 transition-colors [&.active]:bg-ai" />
      <div>
        <p className="text-[15px] font-medium text-foreground">{t('Finding a match…')}</p>
        <p className="text-[13px] text-muted-foreground">{t('Comparing amounts, names and invoice numbers.')}</p>
      </div>
    </div>
  )
}

function Card({ rc, sug, onAccept, onSkip }: { rc: BankReceipt; sug: Suggestion | null; onAccept: () => void; onSkip: () => void }) {
  const t = useT()
  const ask = useUI((s) => s.openAssistant)
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">{t('Received on')} {formatDate(rc.date)}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{formatINR(rc.amount)}</p>
        </div>
        <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Landmark className="size-4" aria-hidden /></span>
      </div>
      <p className="mt-3 break-words rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs leading-relaxed text-foreground/80" title={t('Bank narration')}>{rc.narration}</p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sug?.receivable.id ?? 'none'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="mt-4 flex flex-1 flex-col">
          {sug ? (
            <>
              <div className="flex-1 rounded-xl border border-ai/20 bg-ai/[0.04] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ai"><Sparkles className="size-3.5" aria-hidden />{t('AI suggests')}</span>
                  <Confidence value={sug.score} />
                </div>
                <p className="mt-2 text-[15px] font-medium text-foreground">{sug.receivable.customer}</p>
                <p className="text-[13px] tabular-nums text-muted-foreground">{t('Still owes')} {formatINR(sug.receivable.amount)}</p>
                <ul className="mt-2.5 space-y-1">
                  {sug.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[13px] text-foreground/85"><Check className="mt-0.5 size-3.5 shrink-0 text-sev-ok" aria-hidden />{r}</li>
                  ))}
                </ul>
                <div className="mt-3"><EvidenceChip ev={sug.evidence} /></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="h-10 flex-1 px-4" onClick={onAccept}>{t('Accept match')}</Button>
                <Button variant="outline" className="h-10 px-4" onClick={onSkip}>{t('Not this one')}</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-4 rounded-xl border border-dashed border-border p-3.5">
              <p className="text-[13px] text-muted-foreground">{t('No likely customer found. This stays on the list for the auditor to look at.')}</p>
              <Button variant="outline" className="h-10 px-4" onClick={() => ask(`Which customer might have paid ${formatINR(rc.amount)}? The bank note says: "${rc.narration}"`)}>{t('Ask AI')}</Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function PaymentMatching() {
  const t = useT()
  const reduce = useReducedMotion()
  const receipts = useAudit((s) => s.bankReceipts)
  const recs = useAudit((s) => s.receivables)
  const [skipped, setSkipped] = useState<Record<string, string[]>>({})
  const [scanning, setScanning] = useState(!scannedOnce)

  useEffect(() => {
    if (!scanning) return
    const id = setTimeout(() => { scannedOnce = true; setScanning(false) }, 700)
    return () => clearTimeout(id)
  }, [scanning])

  const unmatched = useMemo(() => receipts.filter((r) => !r.matchedReceivableId), [receipts])

  function accept(rc: BankReceipt, sug: Suggestion) {
    // immutable update: tag the receipt, shrink the invoice, move its "last paid" date forward
    useAudit.setState((s) => ({
      bankReceipts: s.bankReceipts.map((b) => (b.id === rc.id ? { ...b, matchedReceivableId: sug.receivable.id } : b)),
      receivables: s.receivables.map((r) => r.id === sug.receivable.id
        ? { ...r, amount: Math.max(0, r.amount - rc.amount), lastPaymentDate: !r.lastPaymentDate || rc.date > r.lastPaymentDate ? rc.date : r.lastPaymentDate }
        : r),
    }))
    useAudit.getState().log('decision', `Auditor matched ${formatINR(rc.amount)} bank receipt to ${sug.receivable.customer} (${sug.receivable.invoiceNo})`)
    play('success')
    toast.success(`${formatINR(rc.amount)} ${tr('credited to')} ${sug.receivable.customer}`)
  }
  const skip = (rc: BankReceipt, sug: Suggestion) => { play('tap'); setSkipped((m) => ({ ...m, [rc.id]: [...(m[rc.id] ?? []), sug.receivable.id] })) }

  return (
    <section id="unmatched" className="scroll-mt-6">
      <SectionHead title="Payments waiting to be matched" term="Bank receipts not yet credited to a customer" />
      {scanning && unmatched.length > 0 ? <Scanning /> : unmatched.length === 0 ? (
        <EmptyState title={t('Every payment is matched')} body={t('All bank receipts have been credited to the right customer.')} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={!reduce}>
            {unmatched.map((rc, i) => {
              const sug = suggestMatch(rc, recs, skipped[rc.id])
              return (
                <motion.li
                  key={rc.id} layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, x: 24 }}
                  transition={{ delay: Math.min(i, 5) * 0.05, duration: 0.25, ease: 'easeOut', layout: { type: 'spring', stiffness: 500, damping: 40 } }}
                >
                  <Card rc={rc} sug={sug} onAccept={() => sug && accept(rc, sug)} onSkip={() => sug && skip(rc, sug)} />
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
