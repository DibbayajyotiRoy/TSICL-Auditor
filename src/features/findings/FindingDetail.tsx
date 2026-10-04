import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Check, CircleHelp, FileText, Search, Sparkles, Workflow, X } from 'lucide-react'
import type { EvidenceRef, Finding, FindingStatus } from '@/data/types'
import { AREA_LABEL } from '@/data/types'
import { useAudit } from '@/data/store'
import { AiInsight, Confidence, EvidenceChip, SeverityBadge } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { cn, formatDate, formatINR, timeAgo } from '@/lib/utils'
import { DecisionBar } from './DecisionBar'
import { Disclosure } from './Disclosure'
import { DocSheet, EvidenceChain } from './EvidenceGraph'
import { byTrail, SEV_STYLE, STATUS_LABEL } from './shared'

/** "₹8,42,000 purchase" — what the money is, in a word. */
const NOUN: Partial<Record<EvidenceRef['kind'], string>> = {
  purchase_order: 'purchase', quotation: 'quotation', invoice: 'invoice', payment_voucher: 'payment', grn: 'goods received',
  ledger: 'owed to us', bank: 'bank entry', bank_statement: 'bank entry', asset_register: 'asset', contract: 'contract', scrap_auction: 'scrap sale', approval_note: 'approval',
}
const DECISION_TEXT: Record<Exclude<FindingStatus, 'open'>, string> = {
  confirmed: 'Confirmed by auditor', rejected: 'Marked “not an issue” by auditor', investigating: 'Sent for investigation by auditor',
}
const DECISION_ICON = { confirmed: Check, rejected: X, investigating: Search }

export function FindingDetail({ finding: f, onDecide, onBack }: {
  finding: Finding; onDecide: (s: FindingStatus, note?: string) => void; onBack: () => void
}) {
  const reduce = useReducedMotion()
  const rule = useAudit((s) => s.rules.find((r) => r.id === f.ruleId))
  const division = useAudit((s) => s.divisions.find((d) => d.id === f.divisionId))
  const documents = useAudit((s) => s.documents)
  const activity = useAudit((s) => s.activity)
  const [sheet, setSheet] = useState<EvidenceRef | null>(null)
  const t = useT()
  const sev = SEV_STYLE[f.severity]
  const anchor = [...f.evidence].sort(byTrail)[0]
  const noun = anchor && NOUN[anchor.kind]
  const decided = f.status !== 'open' ? activity.find((a) => a.kind === 'decision' && a.text.includes(`${f.id} as`)) : undefined
  const desktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  const scope = (f.scopeRef ?? rule?.scopeRef)?.replace(/^EOI Scope:\s*/i, '')

  /** Turn a basis row into something the document sheet can open. */
  const resolve = (docId: string | undefined, label: string): EvidenceRef =>
    f.evidence.find((e) => (docId && e.docId === docId) || e.label === label)
    ?? { docId, label, kind: documents.find((d) => d.id === docId)?.kind ?? 'register' }

  const StatusIcon = f.status !== 'open' ? DECISION_ICON[f.status] : null
  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="-ml-2 h-10 self-start lg:hidden" onClick={onBack}><ArrowLeft /> {t('All findings')}</Button>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={f.id} className="flex flex-col gap-4"
          initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>

          {/* PRIMARY: readable in five seconds */}
          <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <SeverityBadge severity={f.severity} />
              {StatusIcon && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground">
                  <StatusIcon className="size-3.5" aria-hidden />{t(STATUS_LABEL[f.status])}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                <span className="font-mono">{f.id}</span> · {division?.name ?? f.divisionId} · {t(AREA_LABEL[f.area])}
              </span>
            </div>

            {f.amount > 0 && (
              <p className="mt-5 flex flex-wrap items-baseline gap-x-3 text-foreground">
                <span className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{formatINR(f.amount)}</span>
                {noun && <span className="text-[17px] text-muted-foreground">{t(noun)}</span>}
              </p>
            )}
            <h2 className={cn('text-2xl leading-tight font-semibold tracking-tight text-foreground', f.amount > 0 ? 'mt-3' : 'mt-5')}>{f.title}</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">{f.summary}</p>

            <div className={cn('mt-5 rounded-xl border p-4', sev.box)}>
              <p className="text-[13px] font-medium text-muted-foreground">{t('Why we’re showing this')}</p>
              <p className="mt-1 text-[16px] leading-snug font-medium text-foreground">{f.reason}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('Evidence')}</span>
                {f.evidence.map((ev, i) => <EvidenceChip key={i} ev={ev} onClick={() => setSheet(ev)} />)}
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:ml-auto">
                <Sparkles className="size-3.5 text-ai" aria-hidden />
                <span className="text-muted-foreground">{t('AI confidence')}</span>
                <Confidence value={f.confidence} />
              </div>
            </div>
          </article>

          {/* SECONDARY */}
          <Disclosure tour="evidence" icon={<Workflow />} title={t('View evidence chain')} openTitle={t('Hide evidence chain')}>
            <EvidenceChain finding={f} rule={rule} onOpen={setSheet} />
          </Disclosure>

          <Disclosure icon={<CircleHelp />} title={t('Why did the AI flag this?')} defaultOpen={desktop}>
            <div className="space-y-5">
              <div>
                <h4 className="mb-2 text-[13px] font-medium text-muted-foreground">{t('What the AI looked at')}</h4>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {f.basis?.length ? f.basis.map((b, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => setSheet(resolve(b.docId, b.doc))}
                        className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3.5 py-2.5 text-left text-[14px] transition-colors duration-150 hover:bg-muted/50">
                        <FileText className="size-4 translate-y-0.5 self-start text-muted-foreground" aria-hidden />
                        <span className="font-mono text-[13px] text-foreground/80">{b.doc}</span>
                        <span className="text-muted-foreground" aria-hidden>→</span>
                        <span className="text-muted-foreground">{b.field}</span>
                        <span className="text-muted-foreground" aria-hidden>=</span>
                        <span className="font-medium tabular-nums text-foreground">{b.value}</span>
                      </button>
                    </li>
                  )) : (
                    <>
                      {f.evidence.map((ev, i) => (
                        <li key={i}>
                          <button type="button" onClick={() => setSheet(ev)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] transition-colors duration-150 hover:bg-muted/50">
                            <FileText className="size-4 text-muted-foreground" aria-hidden /><span className="font-mono text-[13px]">{ev.label}</span>
                          </button>
                        </li>
                      ))}
                      <li className="px-3.5 py-2.5 text-[14px] text-foreground">{f.reason}</li>
                    </>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-[13px] font-medium text-muted-foreground">{t('The rule it applied')}</h4>
                <p className="text-[14px] font-medium text-foreground">{rule?.name ?? f.title}{rule && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{rule.id}</span>}</p>
                {rule?.plain && <p className="mt-0.5 text-[14px] text-muted-foreground">{rule.plain}</p>}
                {scope && <p className="mt-2 text-[13px] text-muted-foreground">{t('From TSICL audit scope:')} <span className="text-foreground">{scope}</span></p>}
              </div>
              <p className="text-xs text-muted-foreground">{f.engine ?? t('Rule engine (deterministic)')} · {t('generated')} {formatDate(f.createdAt)}</p>
            </div>
          </Disclosure>

          <AiInsight ask={`Explain finding ${f.id} in simple words and what I should check next`}>
            <p className="font-medium text-foreground">{t('Ask AI about this')}</p>
            <p className="text-muted-foreground">{t('The assistant can explain this in simple words and suggest what to check next. It only suggests; you decide.')}</p>
          </AiInsight>

          <section aria-labelledby="trail-h" className="rounded-2xl border border-border bg-card p-4">
            <h3 id="trail-h" className="mb-3 text-[14px] font-medium text-foreground">{t('Audit trail')}</h3>
            <ol className="relative space-y-4 border-l border-border pl-5">
              <li className="relative">
                <span className="absolute top-0.5 -left-[29px] grid size-4 place-items-center rounded-full bg-ai/10 text-ai ring-4 ring-card"><Sparkles className="size-2.5" aria-hidden /></span>
                <p className="text-[14px] text-foreground">{t('Flagged by AI assistant on')} {formatDate(f.createdAt)}</p>
              </li>
              {f.status !== 'open' && (
                <li className="relative">
                  <span className="absolute top-0.5 -left-[29px] grid size-4 place-items-center rounded-full bg-foreground text-background ring-4 ring-card"><Check className="size-2.5" aria-hidden /></span>
                  <p className="text-[14px] text-foreground">{t(DECISION_TEXT[f.status])}{decided && <span className="text-muted-foreground"> · {timeAgo(decided.at)}</span>}</p>
                  {f.note && <p className="mt-0.5 text-[13px] text-muted-foreground">“{f.note}”</p>}
                </li>
              )}
            </ol>
          </section>
        </motion.div>
      </AnimatePresence>

      <DecisionBar key={f.id} finding={f} onDecide={onDecide} />
      <DocSheet ev={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}
