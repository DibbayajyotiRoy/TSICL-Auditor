import { useMemo, useState } from 'react'
import { CalendarCheck, Check, MapPin, Route } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/kit'
import { BlurFade } from '@/components/ui/blur-fade'
import { Button } from '@/components/ui/button'
import { useAudit } from '@/data/store'
import { play } from '@/lib/sound'
import { cn, formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { buildRoute, fmtRange, riskByDivision, type Priority } from './planner'

const LEVEL: Record<Priority, { word: string; text: string; bar: string }> = {
  first: { word: 'Visit first', text: 'text-sev-high', bar: 'bg-sev-high' },
  quarter: { word: 'Visit this quarter', text: 'text-sev-medium', bar: 'bg-sev-medium' },
  desk: { word: 'Desk review is enough', text: 'text-sev-ok', bar: 'bg-sev-ok' },
}

export function VisitPlanner() {
  const t = useT()
  const divisions = useAudit((s) => s.divisions)
  const findings = useAudit((s) => s.findings)
  const risks = useMemo(() => riskByDivision(divisions, findings), [divisions, findings])
  const route = useMemo(() => buildRoute(risks), [risks])
  const [planned, setPlanned] = useState<ReadonlySet<string>>(new Set())
  const max = Math.max(1, ...risks.map((r) => r.score))
  const when = (id: string) => route.find((s) => s.risk.division.id === id)

  const planOne = (id: string) => {
    const r = risks.find((x) => x.division.id === id)!
    const stop = when(id)
    setPlanned(new Set(planned).add(id))
    play('confirm')
    toast.success(`${t('Visit planned')}: ${r.division.name}`, { description: stop ? `${r.division.location} · ${fmtRange(stop.start, stop.end)} 2026` : `${r.division.location} · ${t('date to be fixed')}` })
  }
  const planAll = () => {
    setPlanned(new Set([...planned, ...route.map((s) => s.risk.division.id)]))
    play('confirm')
    toast.success(`${route.length} ${t('visits planned')}`, { description: `${fmtRange(route[0].start, route[route.length - 1].end)} 2026` })
  }
  const allPlanned = route.length > 0 && route.every((s) => planned.has(s.risk.division.id))

  if (risks.length === 0) return <EmptyState title="No divisions to plan visits for" body="Divisions appear here once records are loaded." />

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="order-2 grid content-start gap-4 sm:grid-cols-2 lg:order-1">
        {risks.map((r, i) => {
          const L = LEVEL[r.level]
          const done = planned.has(r.division.id)
          return (
            <BlurFade key={r.division.id} delay={0.04 * Math.min(i, 6)} className="h-full">
              <article className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-foreground/15 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-balance text-[15px] font-semibold tracking-tight">{r.division.name}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span>{r.division.location}</span><span aria-hidden>·</span>
                      <span className="tabular-nums">{r.km ? `~${r.km} ${t('km from Agartala HO')}` : t('At Head Office')}</span>
                    </p>
                  </div>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground" title={t('Visit priority')}>{i + 1}</span>
                </div>

                <dl className="grid grid-cols-3 gap-2">
                  <div><dt className="text-xs text-muted-foreground">{t('Open issues')}</dt><dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{r.open}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t('Urgent')}</dt><dd className={cn('mt-0.5 text-2xl font-semibold tracking-tight tabular-nums', r.urgent > 0 && 'text-sev-critical')}>{r.urgent}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t('At risk')}</dt><dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{formatINRShort(r.amount)}</dd></div>
                </dl>

                <div className="mt-auto space-y-3">
                  <div>
                    <p className={cn('text-xs font-medium', L.text)}>{t(L.word)}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className={cn('h-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none', L.bar)} style={{ transform: `scaleX(${r.score / max})` }} />
                    </div>
                  </div>
                  <Button variant={done ? 'secondary' : 'outline'} size="lg" disabled={done} onClick={() => planOne(r.division.id)} className="h-10 w-full text-sm">
                    {done ? <><Check className="size-4" aria-hidden />{t('Visit planned')}</> : <><CalendarCheck className="size-4" aria-hidden />{t('Plan visit')}</>}
                  </Button>
                </div>
              </article>
            </BlurFade>
          )
        })}
      </div>

      <aside className="order-1 lg:order-2">
        <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"><Route className="size-4 text-muted-foreground" aria-hidden />{t('Suggested route for this quarter')}</h3>
          <p className="mt-1 text-pretty text-xs text-muted-foreground">{t('Riskiest offices first. Skips Sundays; offices over 100 km away get two days.')}</p>
          {route.length === 0 ? (
            <p className="mt-5 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{t('No visits needed right now — nothing urgent outside Head Office.')}</p>
          ) : (
            <>
              <ol className="mt-5">
                {route.map((s, i) => (
                  <li key={s.risk.division.id} className={cn('relative pl-10', i < route.length - 1 && 'pb-6 before:absolute before:top-7 before:bottom-0 before:left-[13px] before:w-px before:bg-border')}>
                    <span className="absolute top-0 left-0 grid size-7 place-items-center rounded-full border border-border bg-card text-xs font-semibold tabular-nums">{i + 1}</span>
                    <p className="text-sm font-semibold tabular-nums">{fmtRange(s.start, s.end)}</p>
                    <p className="text-[14px] font-medium">{s.risk.division.name}</p>
                    <p className="text-xs text-muted-foreground">{s.risk.division.location} · ~{s.risk.km} {t('km')} · {t('about')} {Math.max(1, Math.round(s.risk.km / 40 * 2) / 2)} {t('h by road')}</p>
                    <p className="mt-1 text-xs tabular-nums text-foreground/80">{s.risk.open} {t('open')} · {s.risk.urgent} {t('Urgent')} · {formatINRShort(s.risk.amount)} {t('at risk')}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-border pt-4 text-xs tabular-nums text-muted-foreground">
                {route.length} {route.length === 1 ? t('visit') : t('visits')} · {t('about')} {route.reduce((a, s) => a + s.risk.km * 2, 0).toLocaleString('en-IN')} {t('km round trip in total')}
              </p>
              <Button size="lg" disabled={allPlanned} onClick={planAll} className="mt-4 h-11 w-full text-sm">
                {allPlanned ? <><Check className="size-4" aria-hidden />{t('Route planned')}</> : <><CalendarCheck className="size-4" aria-hidden />{t('Plan the whole route')}</>}
              </Button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
