// Live pipeline strip: Received -> Reading -> Sorted -> Extracted -> Checked, with counts that tick as documents travel.
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ListChecks, Mail, ScanText, ShieldCheck, Tags, type LucideIcon } from 'lucide-react'
import type { AuditDocument } from '@/data/types'
import { NumberTicker } from '@/components/ui/number-ticker'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { STAGES, stageOf, useFlow } from './flow'
import { MAILBOX } from './model'

const ICONS: LucideIcon[] = [Mail, ScanText, Tags, ListChecks, ShieldCheck]

export function Pipeline({ docs }: { docs: AuditDocument[] }) {
  const t = useT()
  const flight = useFlow((s) => s.stage)
  const reduce = useReducedMotion()
  // Funnel: how many documents have reached each stage. A document still being checked has not reached "Checked" yet.
  const counts = STAGES.map((_, i) => docs.filter((d) => { const s = stageOf(d, flight); return flight[d.id] !== undefined ? i <= 3 && s >= i : s >= i }).length)
  const busy = STAGES.map((_, i) => docs.filter((d) => (flight[d.id] ?? (d.status === 'processing' ? 1 : -1)) === i).length)
  const needLook = docs.filter((d) => d.status === 'needs_review' && flight[d.id] === undefined).length
  // One short sweep per hop: key = doc + stage, so it plays once when the document arrives at a stage.
  const hops = Object.entries(flight).filter(([, s]) => s >= 1)

  return (
    <section aria-label="Document pipeline" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-[13px] font-medium text-foreground">{t('AI-assisted pipeline')}</h2>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
          <span className="font-mono">{MAILBOX}</span>
          <span aria-hidden>·</span>
          <span>{t('Demo mailbox — simulation')}</span>
        </p>
      </div>
      <ol className="grid grid-cols-5">
        {STAGES.map((label, i) => {
          const Icon = ICONS[i]
          const active = busy[i] > 0
          const reached = counts[i] > 0
          return (
            <li key={label} className="relative flex min-w-0 flex-col items-center px-0.5 text-center">
              {i < STAGES.length - 1 && (
                <span aria-hidden className="absolute left-1/2 top-5 h-px w-full -translate-y-1/2 overflow-hidden bg-border">
                  <span className={cn('absolute inset-0 origin-left bg-ai/40 transition-transform duration-500 ease-out', counts[i + 1] > 0 ? 'scale-x-100' : 'scale-x-0')} />
                  {!reduce && hops.filter(([, s]) => s - 1 === i).map(([id, s]) => (
                    <motion.span key={`${id}-${s}`} className="absolute inset-0 origin-left bg-ai" initial={{ scaleX: 0, opacity: 0.9 }} animate={{ scaleX: 1, opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                  ))}
                </span>
              )}
              <span className={cn('relative z-10 grid size-10 place-items-center rounded-full border bg-card transition-colors duration-300', active ? 'border-ai/50 bg-ai/10 text-ai' : reached ? 'border-border text-foreground' : 'border-border text-muted-foreground/60')}>
                <Icon className="size-[18px]" aria-hidden />
                {active && !reduce && (
                  <motion.span aria-hidden className="absolute inset-0 rounded-full border border-ai" initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.55, opacity: 0 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }} />
                )}
              </span>
              <span className="mt-2 w-full text-[11px] font-medium break-words text-foreground sm:text-[13px]">{t(label)}</span>
              <NumberTicker value={counts[i]} className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight text-foreground dark:text-foreground sm:text-[26px]" />
              <span className={cn('mt-1.5 flex min-h-4 items-center justify-center gap-1 text-center text-[11px] leading-tight break-words sm:text-xs', active ? 'text-ai' : 'text-sev-high')}>
                {active ? <>{busy[i]} {t('in progress')}</> : i === 3 && needLook > 0 ? <><AlertTriangle className="hidden size-3 sm:block" aria-hidden />{needLook} {t('need a look')}</> : null}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
