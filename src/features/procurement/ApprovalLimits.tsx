import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertOctagon, CircleCheck } from 'lucide-react'
import { formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { PoRow } from './analysis'
import { NoData, Section } from './parts'

const SHOW = 5

/** One bar per flagged PO: amount vs the approver's delegated limit, overflow in the critical colour. */
export function ApprovalLimits({ over, onOpen }: { over: PoRow[]; onOpen: (id: string) => void }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const reduce = useReducedMotion()
  const rows = all ? over : over.slice(0, SHOW)
  const scale = Math.max(...rows.map((r) => r.po.amount), 1) // one shared axis so lengths compare honestly

  return (
    <Section title="Approval limits" caption="Each officer can only approve up to a certain amount.">
      {over.length === 0 ? (
        <NoData><CircleCheck className="size-4 text-sev-ok" aria-hidden />{t("Every purchase was approved within the approver's limit.")}</NoData>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3 rounded-[2px] bg-foreground/25" />{t("Within the officer's limit")}</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3 rounded-[2px] bg-sev-critical" />{t('Above the limit')}</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-0.5 bg-foreground" />{t("Officer's limit")}</span>
          </div>
          <ul className="space-y-1">
            {rows.map(({ po, overBy }) => {
              const w1 = (Math.min(po.amount, po.approverLimit) / scale) * 100
              const w2 = (overBy / scale) * 100
              return (
                <li key={po.id}>
                  <button type="button" onClick={() => onOpen(po.id)} aria-label={`${po.id}: ${formatINR(overBy)} ${t('over limit')}. ${t('Open details')}`}
                    className="group -mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="min-w-0 truncate text-[13px] text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">{po.id}</span>
                        <span className="mx-1.5 text-muted-foreground/50">·</span>{po.vendor}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium tabular-nums text-sev-critical">
                        <AlertOctagon className="size-3.5" aria-hidden />{formatINR(overBy)} {t('over limit')}
                      </span>
                    </div>
                    <div className="relative mt-2 h-6">
                      <motion.div className="absolute inset-x-0 top-1.5 flex h-3 origin-left gap-0.5"
                        initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
                        <div className="h-full rounded-l-[4px] bg-foreground/25" style={{ width: `calc(${w1}% - 1px)` }} />
                        <div className="h-full rounded-r-[4px] bg-sev-critical" style={{ width: `calc(${w2}% - 1px)` }} />
                      </motion.div>
                      <div className="absolute top-0 h-6 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${w1}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {po.approvedBy} {t('can approve up to')} <span className="tabular-nums">{formatINR(po.approverLimit)}</span>; {t('this purchase was')} <span className="tabular-nums">{formatINR(po.amount)}</span>.
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
          {over.length > SHOW && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 h-10 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {all ? t('Show fewer') : `${t('Show all')} ${over.length}`}
            </button>
          )}
        </>
      )}
    </Section>
  )
}
