// Shared building blocks. Every page MUST use these for headers, KPIs, severity, evidence and AI callouts
// so the whole app reads as one product. Design worker may restyle internals; props are the contract.
import type { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, ArrowRight, ArrowUpRight, FolderOpen, Info, CircleDot, FileText, Sparkles } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import type { EvidenceRef, Severity } from '@/data/types'
import { SEVERITY_LABEL } from '@/data/types'
import { cn } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/number-ticker'
import { BorderBeam } from '@/components/ui/border-beam'
import { useUI } from '@/lib/ui'
import { useT } from '@/lib/i18n'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const t = useT()
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-[1.15] font-semibold tracking-tight text-balance text-foreground">{t(title)}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-pretty text-muted-foreground">{t(subtitle)}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

const SEV: Record<Severity, { icon: typeof Info; cls: string }> = {
  critical: { icon: AlertOctagon, cls: 'bg-sev-critical/10 text-sev-critical ring-sev-critical/25' },
  high: { icon: AlertTriangle, cls: 'bg-sev-high/10 text-sev-high ring-sev-high/25' },
  medium: { icon: CircleDot, cls: 'bg-sev-medium/10 text-sev-medium ring-sev-medium/25' },
  low: { icon: Info, cls: 'bg-sev-low/10 text-sev-low ring-sev-low/25' },
}
/** Colour + icon + word, never colour alone. */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const t = useT()
  const { icon: Icon, cls } = SEV[severity]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full py-0 pr-2.5 pl-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset', cls, className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(SEVERITY_LABEL[severity])}
    </span>
  )
}

/** One dominant number + plain-language question + optional delta/verdict. */
export function KpiCard({ label, value, format = 'number', hint, tone = 'neutral', icon, onClick }: {
  label: string // phrased as a question/sentence: "Money at risk"
  value: number
  format?: 'number' | 'inr' | 'percent'
  hint?: string // "↑ 3 since last week"
  tone?: 'neutral' | 'good' | 'bad' | 'warn'
  icon?: ReactNode
  onClick?: () => void
}) {
  const t = useT()
  const prefix = format === 'inr' ? '₹' : ''
  const suffix = format === 'percent' ? '%' : ''
  const short = format === 'inr' && value >= 1e5
  const shown = short ? (value >= 1e7 ? value / 1e7 : value / 1e5) : value
  const unit = short ? (value >= 1e7 ? ' Cr' : ' L') : ''
  const body = (
    <>
      <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-muted-foreground">
        <span className="min-w-0 text-pretty">{t(label)}</span>
        {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-0.5 text-[34px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
        {prefix}<NumberTicker value={shown} decimalPlaces={short ? 1 : 0} className="text-foreground" />{unit}{suffix}
      </div>
      {(hint || onClick) && (
        <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
          <span className={cn({ neutral: 'text-muted-foreground', good: 'text-sev-ok', bad: 'text-sev-critical', warn: 'text-sev-high' }[tone])}>{hint && t(hint)}</span>
          {onClick && <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" aria-hidden />}
        </div>
      )}
    </>
  )
  const base = 'group relative flex min-h-[132px] w-full flex-col justify-between rounded-2xl border border-border bg-card p-5 text-left'
  if (!onClick) return <div className={base}>{body}</div>
  return (
    <button type="button" onClick={onClick}
      className={cn(base, 'transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-foreground/15 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]')}>
      {body}
    </button>
  )
}

/** Clickable source chip — every AI claim links to its evidence. */
export function EvidenceChip({ ev, onClick }: { ev: EvidenceRef; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 font-mono text-xs text-foreground/80 transition-[color,background-color,border-color] duration-150 enabled:hover:border-foreground/15 enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-default">
      <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{ev.label}</span>
    </button>
  )
}

/** Confidence in words, not a bare %. */
export function Confidence({ value }: { value: number }) {
  const t = useT()
  const [word, cls] = value >= 0.9 ? ['High confidence', 'text-sev-ok'] : value >= 0.7 ? ['Likely', 'text-sev-medium'] : ['Please double-check', 'text-sev-high']
  return <span className={cn('text-xs font-medium tabular-nums', cls)} title={`${Math.round(value * 100)}%`}>{t(word)} · {Math.round(value * 100)}%</span>
}

/** AI callout: plain-language insight + "Ask AI about this" handoff to the assistant. A slow violet beam runs round the border only when `ask` is set. */
export function AiInsight({ children, ask, className }: { children: ReactNode; ask?: string; className?: string }) {
  const t = useT()
  const openAssistant = useUI((s) => s.openAssistant)
  const reduce = useReducedMotion()
  return (
    <div className={cn('relative flex items-start gap-3 rounded-2xl border border-ai/20 bg-ai/[0.04] p-4', className)}>
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-ai/10 text-ai"><Sparkles className="size-4" aria-hidden /></span>
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-pretty text-foreground/90">{children}</div>
      {ask && (
        <button type="button" onClick={() => openAssistant(ask)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ai transition-colors duration-150 hover:bg-ai/10">
          {t('Ask AI')}<ArrowRight className="size-3.5" aria-hidden />
        </button>
      )}
      {ask && !reduce && <BorderBeam size={72} duration={9} borderWidth={1.5} colorFrom="var(--ai)" colorTo="transparent" />}
    </div>
  )
}

/** Friendly empty state with one next action. */
export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground [&>svg]:size-5">{icon ?? <FolderOpen aria-hidden />}</span>
      <p className="text-[15px] font-medium text-balance text-foreground">{t(title)}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">{t(body)}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
