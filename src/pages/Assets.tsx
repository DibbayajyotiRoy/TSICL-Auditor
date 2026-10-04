import '@/features/assets/__dev'
import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Boxes, ClipboardList, Eye, EyeOff, ScanLine, TriangleAlert } from 'lucide-react'
import { AiInsight, EmptyState, KpiCard, PageHeader } from '@/components/kit'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import { BlurFade } from '@/components/ui/blur-fade'
import { Button } from '@/components/ui/button'
import { useAudit } from '@/data/store'
import { ChecklistDialog } from '@/features/assets/Checklist'
import { findIssues, FY_START, summarize } from '@/features/assets/derive'
import { NO_FILTERS, Register, type Filters } from '@/features/assets/Register'
import { VerifyOnSite } from '@/features/assets/VerifyOnSite'
import { cn, formatDate, formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const barTone = (pct: number) => (pct >= 70 ? 'bg-sev-ok' : pct >= 40 ? 'bg-sev-medium' : 'bg-sev-high')

export default function Assets() {
  const t = useT()
  const assets = useAudit((s) => s.assets)
  const divisions = useAudit((s) => s.divisions)
  const reduce = useReducedMotion()
  const s = useMemo(() => summarize(assets), [assets])
  const issues = useMemo(() => findIssues(assets, divisions), [assets, divisions])
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [ready, setReady] = useState(false) // lets the ring and bars grow in on first paint
  useEffect(() => { const t = setTimeout(() => setReady(true), 150); return () => clearTimeout(t) }, [])

  const jump = (p: Partial<Filters>) => {
    setF({ ...NO_FILTERS, ...p })
    document.getElementById('asset-register')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const header = (
    <PageHeader title="Assets & Equipment" subtitle="Everything TSICL owns, and whether someone has physically seen it this year."
      actions={s.total > 0 && (
        <>
          <Button variant="outline" className="h-10 gap-2 px-4" onClick={() => setListOpen(true)}><ClipboardList /> {t('Physical verification list')}</Button>
          <Button className="h-10 gap-2 px-4" onClick={() => setVerifyOpen(true)}><ScanLine /> {t('Verify on site')}</Button>
        </>
      )} />
  )
  if (!s.total) {
    return <div className="mx-auto max-w-[1280px]">{header}<EmptyState title="No assets in the register yet" body="Upload the fixed assets register from the Document Inbox and it will appear here." /></div>
  }

  const dueValue = s.locations.reduce((n, l) => n + l.dueValue, 0)
  const top = [...s.locations].sort((a, b) => b.dueValue - a.dueValue)[0]
  const dupes = [...issues.values()].filter((i) => i.includes('duplicate')).length
  const locations = s.locations.map((l) => l.loc).sort()

  return (
    <div className="mx-auto max-w-[1280px]">
      {header}
      <div className="flex flex-col gap-6">
        <BlurFade>
          <div data-tour="kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Total assets" value={s.total} hint={`${t('Worth')} ${formatINRShort(s.value)}`} icon={<Boxes />} onClick={() => jump({})} />
            <KpiCard label="Verified this year" value={s.checked} tone="good" hint={`${s.pct}% ${t('of the register')}`} icon={<Eye />} onClick={() => jump({ status: 'verified' })} />
            <KpiCard label="Never verified" value={s.never} tone={s.never ? 'warn' : 'neutral'} hint="No physical check on record" icon={<EyeOff />} onClick={() => jump({ issue: 'never' })} />
            <KpiCard label="Missing or damaged" value={s.missing + s.damaged} tone={s.missing + s.damaged ? 'bad' : 'neutral'} hint={`${s.missing} ${t('missing')} · ${s.damaged} ${t('damaged')}`} icon={<TriangleAlert />} onClick={() => jump({ status: 'flagged' })} />
          </div>
        </BlurFade>

        <BlurFade delay={0.05}>
          <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 lg:grid-cols-[auto_1fr] lg:gap-12">
            <div className="flex items-center gap-5">
              <AnimatedCircularProgressBar value={ready ? s.pct : 0} gaugePrimaryColor="var(--sev-ok)" gaugeSecondaryColor="var(--muted)" className="size-32 shrink-0 text-3xl tracking-tight tabular-nums" />
              <div>
                <p className="text-[22px] font-semibold leading-tight tracking-tight tabular-nums">{s.pct}% {t('physically verified')}</p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">{s.checked} {t('of')} {s.total} {t('assets seen since')} {formatDate(FY_START)}</p>
              </div>
            </div>
            <ul className="grid content-start gap-x-6 gap-y-1 sm:grid-cols-2">
              {s.locations.map((l) => {
                const pct = Math.round((l.checked / l.total) * 100)
                return (
                  <li key={l.loc}>
                    <button type="button" onClick={() => jump({ loc: l.loc })}
                      className="w-full rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{l.loc}</span>
                        <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{l.checked} {t('of')} {l.total} · {pct}%</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full origin-left rounded-full transition-transform duration-700 ease-out', barTone(pct))} style={{ transform: `scaleX(${ready ? pct / 100 : 0})` }} />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </BlurFade>

        <BlurFade delay={0.1}>
          <AiInsight ask="Which assets should we verify first?">
            {dueValue === 0
              ? t('Every asset has been seen this year. Nothing to chase on site.')
              : <>{s.total - s.checked} {s.total - s.checked === 1 ? t('asset') : t('Assets')} {t('worth')} {formatINRShort(dueValue)} {t('have not been seen this year.')} {top.loc} {t('holds the most')} ({formatINRShort(top.dueValue)}), {t('so start there with the highest-value items.')}{dupes ? <> {dupes} {t('tags appear more than once, so fix those in the register first.')}</> : ''}</>}
          </AiInsight>
        </BlurFade>

        <BlurFade delay={0.15}>
          <div id="asset-register" className="scroll-mt-6">
            <Register assets={assets} issues={issues} locations={locations} f={f} setF={setF} />
          </div>
        </BlurFade>
      </div>

      <VerifyOnSite open={verifyOpen} onOpenChange={setVerifyOpen} />
      <ChecklistDialog open={listOpen} onOpenChange={setListOpen} assets={assets} />
    </div>
  )
}
