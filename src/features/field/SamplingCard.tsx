import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { NumberTicker } from '@/components/ui/number-ticker'
import { Switch } from '@/components/ui/switch'
import { useAudit } from '@/data/store'
import { play } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { sampleSize, Z, type Confidence } from './sampling'

const LEVELS: Confidence[] = [90, 95, 99]

function Control({ label, hint, value, children }: { label: string; hint?: string; value?: string; children: React.ReactNode }) {
  const t = useT()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium">{t(label)}</p>
        {value && <p className="text-[13px] font-medium tabular-nums">{value}</p>}
      </div>
      {hint && <p className="mt-0.5 text-pretty text-xs text-muted-foreground">{t(hint)}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

const range = 'block h-10 w-full cursor-pointer accent-foreground'

export function SamplingCard() {
  const t = useT()
  const reduce = useReducedMotion()
  const purchaseOrders = useAudit((s) => s.purchaseOrders)
  const findings = useAudit((s) => s.findings)
  const [popInput, setPopInput] = useState('') // empty = use the real purchase count
  const [conf, setConf] = useState<Confidence>(95)
  const [margin, setMargin] = useState(5)
  const [errRate, setErrRate] = useState(50)
  const [riskBased, setRiskBased] = useState(true)

  const N = popInput === '' ? purchaseOrders.length : Math.max(0, Math.floor(Number(popInput)) || 0)
  const flagged = useMemo(() => {
    const ids = new Set(purchaseOrders.map((p) => p.id))
    return new Set(findings.filter((f) => f.status !== 'rejected').flatMap((f) => f.evidence.map((e) => e.label)).filter((l) => ids.has(l))).size
  }, [purchaseOrders, findings])

  const base = sampleSize(N, conf, margin / 100, errRate / 100)
  const extra = riskBased ? Math.min(flagged, N) : 0
  const total = Math.min(N, base + extra)
  const nearlyAll = N > 0 && total >= 0.9 * N

  return (
    <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-2">
      <div className="space-y-6 bg-card p-6">
        <Control label="How many purchases are there?" hint={`${t('We found')} ${purchaseOrders.length} ${t('purchase orders in the records. Change it to test another number.')}`}>
          <input type="number" inputMode="numeric" min={1} value={popInput} placeholder={String(purchaseOrders.length)} onChange={(e) => setPopInput(e.target.value)}
            aria-label={t('Number of purchases')} className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-[15px] tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
        </Control>

        <Control label="How sure do you want to be?" hint="Higher confidence means checking more.">
          <div role="radiogroup" aria-label={t('Confidence level')} className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {LEVELS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={conf === c} onClick={() => setConf(c)}
                className={cn('relative h-10 rounded-lg text-sm font-medium tabular-nums transition-colors duration-150', conf === c ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {conf === c && <motion.span layoutId="conf-pill" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)] dark:bg-background" />}
                <span className="relative">{c}%</span>
              </button>
            ))}
          </div>
        </Control>

        <Control label="How close to the true figure?" hint="A smaller margin gives a more precise answer but needs a bigger sample." value={`±${margin}%`}>
          <input type="range" min={3} max={10} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} aria-label={t('Margin of error')} className={range} />
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t('More precise')}</span><span>{t('Quicker')}</span></div>
        </Control>

        <Control label="How often do you expect mistakes?" hint="Not sure? Leave it at 50% — that is the safest assumption." value={`${errRate}%`}>
          <input type="range" min={1} max={50} step={1} value={errRate} onChange={(e) => setErrRate(Number(e.target.value))} aria-label={t('Expected error rate')} className={range} />
        </Control>

        <label htmlFor="risk-based" className="flex cursor-pointer select-none items-start justify-between gap-4 rounded-xl border border-border p-4 transition-colors duration-150 hover:bg-muted/40">
          <span>
            <span className="block text-[14px] font-medium">{t('Risk-based: always include all flagged items')}</span>
            <span className="mt-0.5 block text-pretty text-xs text-muted-foreground">{flagged} {flagged === 1 ? t('purchase already flagged by the audit checks is added on top of the random sample.') : t('purchases already flagged by the audit checks are added on top of the random sample.')}</span>
          </span>
          <Switch id="risk-based" checked={riskBased} onCheckedChange={(v) => { setRiskBased(v); play('toggle') }} className="mt-0.5" />
        </label>
      </div>

      <div className="flex flex-col justify-between gap-6 bg-muted/30 p-6">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{t('Purchases to check')}</p>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 font-semibold tracking-tight tabular-nums">
            <NumberTicker value={total} className="text-[64px] leading-none tracking-tight text-foreground" />
            <span className="text-xl text-muted-foreground">{t('of')} {N.toLocaleString('en-IN')}</span>
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full origin-left rounded-full bg-foreground transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${N ? total / N : 0})` }} />
          </div>
          <p className="mt-5 text-pretty text-[15px] leading-relaxed">
            {N === 0 ? t('Enter how many purchases there are to see the sample size.')
              : <>{t('Check')} <strong className="font-semibold tabular-nums">{total}</strong> {t('of')} <span className="tabular-nums">{N}</span> {total === 1 ? t('purchase to be') : t('purchases to be')} <strong className="font-semibold">{conf}%</strong> {t('sure the real error rate is within')} <strong className="font-semibold">±{margin}%</strong> {t('of what you find.')}</>}
          </p>
          {nearlyAll && <p className="mt-2 text-pretty text-sm text-muted-foreground">{t('With this few purchases, a sample saves very little — nearly all of them need checking.')}</p>}
          <p className="mt-2 text-pretty text-sm text-muted-foreground">{t('Pick them at random, so every purchase has an equal chance of being chosen.')}</p>
        </div>

        <div className="space-y-3">
          <dl className="space-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('Chosen at random')}</dt><dd className="font-medium tabular-nums">{base}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t('Flagged, always included')}</dt><dd className="font-medium tabular-nums">{riskBased ? `+ ${extra}` : t('off')}</dd></div>
            <div className="flex justify-between border-t border-border pt-1.5"><dt className="font-medium">{t('Total to check')}</dt><dd className="font-semibold tabular-nums">{total}</dd></div>
          </dl>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none py-1 font-medium transition-colors hover:text-foreground">{t('How this is worked out')}</summary>
            <p className="mt-1 text-pretty leading-relaxed">
              {t("Cochran's formula with a correction for a small population.")} {t('First')} n₀ = z² × p × (1 − p) ÷ e², {t('then')} n = n₀ ÷ (1 + (n₀ − 1) ÷ N).
              {t('Here')} z = {Z[conf]}, p = {errRate}%, e = {margin}%, N = {N}.
            </p>
          </details>
        </div>
      </div>
    </section>
  )
}
