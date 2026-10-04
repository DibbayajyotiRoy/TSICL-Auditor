import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Gavel, ListChecks, ScrollText, ShieldAlert, Sparkles, type LucideIcon } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { NumberTicker } from '@/components/ui/number-ticker'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { HomeStats } from './stats'

/** The visual spine of the product: how a document becomes a board-ready decision. Every step links to its screen. */
export function Flow({ s }: { s: HomeStats }) {
  const t = useT()
  const steps: { icon: LucideIcon; name: string; n: number; caption: string; to: string; ai?: boolean; total?: number }[] = [
    { icon: FileText, name: 'Documents', n: s.docsReceived, caption: 'received', to: '/inbox' },
    { icon: Sparkles, name: 'AI extracts data', n: s.docsProcessed, caption: 'read & sorted', to: '/inbox', ai: true },
    { icon: ListChecks, name: 'Audit Checks', n: s.checksRun, caption: 'checks run', to: '/checks' },
    { icon: ShieldAlert, name: 'Findings', n: s.exceptions, caption: 'raised', to: '/findings' },
    { icon: Gavel, name: 'Auditor decides', n: s.decided, caption: 'of-decided', to: '/findings', total: s.exceptions },
    { icon: ScrollText, name: 'Board report', n: s.confirmed, caption: 'confirmed items', to: '/report', ai: true },
  ]
  return (
    <nav aria-label="Audit workflow" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1.5 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map(({ icon: Icon, name, n, caption, to, ai, total }, i) => (
        <BlurFade key={name} delay={0.2 + 0.05 * i} className="relative">
          <Link to={to} className="group flex min-h-[92px] flex-col justify-between rounded-xl px-3.5 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50">
            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <Icon className={cn('size-4', ai ? 'text-ai' : 'text-muted-foreground')} aria-hidden />{t(name)}
            </span>
            <span className="mt-2 flex items-baseline gap-1.5">
              <NumberTicker value={n} className="text-[22px] font-semibold leading-none tracking-tight text-foreground" />
              <span className="text-xs text-muted-foreground">{caption === 'of-decided' ? <>{t('of')} {total} {t('decided')}</> : t(caption)}</span>
            </span>
          </Link>
          {i < steps.length - 1 && <ChevronRight className="pointer-events-none absolute -right-2.5 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground/60 lg:block" aria-hidden />}
        </BlurFade>
      ))}
    </nav>
  )
}
