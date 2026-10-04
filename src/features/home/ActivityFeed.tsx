import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { AlertTriangle, BellRing, CircleCheck, ClipboardList, FileText, ShieldAlert, Sparkles, type LucideIcon } from 'lucide-react'
import { AnimatedList } from '@/components/ui/animated-list'
import { useAudit } from '@/data/store'
import type { ActivityEvent } from '@/data/types'
import { useT } from '@/lib/i18n'
import { cn, timeAgo } from '@/lib/utils'

const KIND: Record<ActivityEvent['kind'], { icon: LucideIcon; cls: string }> = {
  doc_received: { icon: FileText, cls: 'text-muted-foreground' },
  finding: { icon: AlertTriangle, cls: 'text-sev-high' },
  reminder: { icon: BellRing, cls: 'text-muted-foreground' },
  escalation: { icon: ShieldAlert, cls: 'text-sev-critical' },
  decision: { icon: CircleCheck, cls: 'text-sev-ok' },
  ai: { icon: Sparkles, cls: 'text-ai' },
  report: { icon: ClipboardList, cls: 'text-muted-foreground' },
}
const SHOWN = 8

function Item({ e }: { e: ActivityEvent }) {
  const { icon: Icon, cls } = KIND[e.kind]
  return (
    <div className="flex items-start gap-3 rounded-xl px-2 py-2.5">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg bg-muted', cls)}><Icon className="size-4" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] leading-snug text-foreground/90">{e.text}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{timeAgo(e.at)}</p>
      </div>
    </div>
  )
}

/** Live feed. AnimatedList reveals oldest-first and stacks newer on top, so feed it the latest events reversed. */
export function ActivityFeed() {
  const t = useT()
  const reduce = useReducedMotion()
  const activity = useAudit((s) => s.activity)
  const latest = useMemo(() => activity.slice(0, SHOWN).reverse(), [activity])

  return (
    <section className="absolute inset-0 flex flex-col rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between px-2 pb-2 pt-1.5">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{t('Activity')}</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-sev-ok" aria-hidden />{t('Live')}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-5 [mask-image:linear-gradient(to_bottom,#000_calc(100%-20px),transparent)]" aria-live="polite">
        {latest.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">{t('Quiet for now. New documents and reminders will show up here.')}</p>
        ) : reduce ? (
          <div className="flex flex-col">{[...latest].reverse().map((e) => <Item key={e.id} e={e} />)}</div>
        ) : (
          <AnimatedList delay={140} className="items-stretch gap-0">
            {latest.map((e) => <Item key={e.id} e={e} />)}
          </AnimatedList>
        )}
      </div>
    </section>
  )
}
