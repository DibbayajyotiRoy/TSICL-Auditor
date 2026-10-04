import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, ShieldAlert } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { useT } from '@/lib/i18n'
import { cn, formatINRShort } from '@/lib/utils'
import type { HomeStats } from './stats'

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export function Hero() {
  const t = useT()
  const [greeting] = useState(greet)
  return (
    <div>
      <BlurFade>
        <h1 className="max-w-3xl text-[28px] font-semibold tracking-tight text-balance text-foreground">
          {t(greeting)}. <span className="text-muted-foreground">{t("Here's what changed since the last review.")}</span>
        </h1>
      </BlurFade>
      <BlurFade delay={0.1}>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{t('Q2 FY 2026-27 · AI-assisted audit workflow')}</p>
      </BlurFade>
    </div>
  )
}

/** The one primary action on the page: start with the first thing that needs a human. */
export function Headline({ s }: { s: HomeStats }) {
  const t = useT()
  const n = s.highPriority
  const critical = s.urgent.some((f) => f.severity === 'critical')
  const parts = [
    s.urgent.length && `${s.urgent.length} ${t(s.urgent.length === 1 ? 'finding' : 'findings')} ${t('worth')} ${formatINRShort(s.urgentAmount)}`,
    s.escalations && `${s.escalations} ${t(s.escalations === 1 ? 'escalation' : 'escalations')} ${t('awaiting your approval')}`,
  ].filter(Boolean).join(' · ')

  return (
    <BlurFade delay={0.16}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', n ? (critical ? 'bg-sev-critical/10 text-sev-critical' : 'bg-sev-high/10 text-sev-high') : 'bg-sev-ok/10 text-sev-ok')}>
          {n ? <ShieldAlert className="size-5" aria-hidden /> : <CircleCheck className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[17px] font-semibold tracking-tight text-foreground">
            {n ? <><span className="tabular-nums">{n}</span> {t(n === 1 ? 'high-priority matter needs review' : 'high-priority matters need review')}</> : t('Nothing high-priority needs review')}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{n ? parts : t("You're all caught up. The assistant keeps checking new documents as they arrive.")}</p>
        </div>
        {n > 0 && (
          <Link to={s.attention[0]?.to ?? '/findings'}
            className="group inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-5 text-[14px] font-medium text-background transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.97]">
            {t('Start review')} <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
    </BlurFade>
  )
}
