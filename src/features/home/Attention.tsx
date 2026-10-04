import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { EmptyState, SeverityBadge } from '@/components/kit'
import { useT } from '@/lib/i18n'
import { formatINRShort } from '@/lib/utils'
import type { HomeStats } from './stats'

/** Findings plus other items that still need a human, worst first. The whole row is one link; the CTA is its visual button. */
export function Attention({ s }: { s: HomeStats }) {
  const t = useT()
  const n = s.attention.length
  return (
    <section data-tour="attention" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{t('Needs your attention')}</h2>
          <p className="text-[13px] text-muted-foreground">{n ? t('Most serious first. The assistant suggests, you decide.') : t('All clear')}</p>
        </div>
        {s.open.length > 0 && (
          <Link to="/findings" className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {t('See all')} {s.open.length}
          </Link>
        )}
      </div>

      {n === 0 ? (
        <div className="px-4 pb-4"><EmptyState title={t('Nothing urgent today 🎉')} body={t('New items appear here the moment the assistant finds them.')} /></div>
      ) : (
        s.attention.map((a, i) => (
          <BlurFade key={a.key} delay={0.05 * i}>
            <Link to={a.to}
              className="group flex min-h-[72px] flex-col gap-2 border-t border-border px-5 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:flex-row sm:items-center sm:gap-4">
              <div className="sm:w-28 sm:shrink-0"><SeverityBadge severity={a.severity} /></div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{a.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{a.sub}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="text-[15px] font-semibold tabular-nums text-foreground sm:w-24 sm:text-right">{a.amount ? formatINRShort(a.amount) : ''}</span>
                <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-4 text-[13px] font-medium text-foreground transition-[background-color,color,transform] duration-150 group-hover:bg-foreground group-hover:text-background group-active:scale-[0.97]">
                  {t(a.cta)} <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          </BlurFade>
        ))
      )}
    </section>
  )
}
