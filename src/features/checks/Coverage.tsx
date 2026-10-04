import { Check, Minus } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import type { Area, Rule } from '@/data/types'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { AREA_ORDER, areaName } from './areas'

/** Proof that every audit area in the tender's scope has checks behind it. */
export function Coverage({ rules }: { rules: Rule[] }) {
  const t = useT()
  const count = (a: Area) => rules.filter((r) => r.area === a).length
  const covered = AREA_ORDER.filter((a) => count(a) > 0).length
  const all = covered === AREA_ORDER.length
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <span className={cn('grid size-5 place-items-center rounded-full', all ? 'bg-sev-ok/15 text-sev-ok' : 'bg-sev-medium/15 text-sev-medium')}>
          {all ? <Check className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
        </span>
        {all ? <>{t('Covers all')} {AREA_ORDER.length} {t("audit areas in TSICL's scope")}</> : <>{t('Covers')} {covered} {t('of')} {AREA_ORDER.length} {t("audit areas in TSICL's scope")}</>}
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {AREA_ORDER.map((a, i) => (
          <li key={a}>
            <BlurFade delay={0.03 * i} className="flex h-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-pretty text-[13px] font-medium leading-snug">{t(areaName(a))}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{count(a)} {count(a) === 1 ? t('check') : t('checks')}</p>
              </div>
              {count(a) > 0 ? <Check className="size-4 shrink-0 text-sev-ok" aria-label={t('Covered')} /> : <Minus className="size-4 shrink-0 text-muted-foreground" aria-label={t('Not covered')} />}
            </BlurFade>
          </li>
        ))}
      </ul>
    </section>
  )
}
