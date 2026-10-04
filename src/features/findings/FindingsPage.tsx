import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MotionConfig, motion } from 'motion/react'
import { ListChecks, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Finding, FindingStatus } from '@/data/types'
import { useAudit } from '@/data/store'
import { EmptyState, PageHeader } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useT, tr } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { FindingDetail } from './FindingDetail'
import { DEFAULT_FILTERS, FindingList, type Filters } from './FindingList'
import { SEV_ORDER, useHotkeys } from './shared'

const TOAST: Record<Exclude<FindingStatus, 'open'>, string> = {
  confirmed: 'Finding confirmed', rejected: 'Marked as not an issue', investigating: 'Marked for investigation',
}

export default function FindingsPage() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const findings = useAudit((s) => s.findings)
  const divisions = useAudit((s) => s.divisions)
  const decideInStore = useAudit((s) => s.decide)
  const [filters, setFilters] = useState<Filters>(() => {
    const target = useAudit.getState().findings.find((f) => f.id === id)
    return { ...DEFAULT_FILTERS, status: target && target.status !== 'open' ? 'all' : 'open' } // deep link to a decided finding: show it in the list
  })
  const paneRef = useRef<HTMLDivElement>(null)

  const divName = useMemo(() => new Map(divisions.map((d) => [d.id, d.name])), [divisions])
  const counts = useMemo(() => {
    const c = { all: findings.length, open: 0, confirmed: 0, rejected: 0, investigating: 0 }
    for (const f of findings) c[f.status]++
    return c
  }, [findings])

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return findings
      .filter((f) => (filters.status === 'all' || f.status === filters.status)
        && (!filters.severities.length || filters.severities.includes(f.severity))
        && (filters.area === 'all' || f.area === filters.area)
        && (!q || `${f.id} ${f.title} ${f.summary} ${f.reason} ${divName.get(f.divisionId) ?? ''} ${f.evidence.map((e) => e.label).join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || b.amount - a.amount)
  }, [findings, filters, divName])

  const selected = findings.find((f) => f.id === id) ?? visible[0]
  const reviewed = findings.length - counts.open
  const pct = findings.length ? Math.round((reviewed / findings.length) * 100) : 0
  const allDone = findings.length > 0 && counts.open === 0

  // After a decision (or J/K) the new detail may start above the fold.
  useEffect(() => {
    const el = paneRef.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }, [selected?.id])

  const open = (fid: string, replace = false) => navigate(`/findings/${fid}`, { replace })
  const move = (d: number) => {
    const i = visible.findIndex((f) => f.id === selected?.id)
    const next = visible[Math.min(visible.length - 1, Math.max(0, i < 0 ? 0 : i + d))]
    if (next) open(next.id, true)
  }
  useHotkeys({ j: () => move(1), k: () => move(-1) })

  const decide = (f: Finding, status: Exclude<FindingStatus, 'open'>, note?: string) => {
    if (f.status === status && status !== 'rejected') return
    const prev = { status: f.status, note: f.note ?? '' } // '' not undefined: store keeps the old note on undefined
    const i = visible.findIndex((x) => x.id === f.id)
    const next = [...visible.slice(i + 1), ...visible.slice(0, Math.max(i, 0))].find((x) => x.id !== f.id && x.status === 'open')
    decideInStore(f.id, status, note)
    play(status === 'confirmed' ? 'confirm' : status === 'rejected' ? 'close' : 'toggle')
    toast(tr(TOAST[status]), {
      description: `${f.id} · ${f.title}`, duration: 6000,
      action: { label: tr('Undo'), onClick: () => { decideInStore(f.id, prev.status, prev.note); play('tap'); open(f.id) } },
    })
    const lastOne = f.status === 'open' && counts.open === 1
    if (lastOne) { play('complete'); navigate('/findings') }
    else if (next) open(next.id)
    else if (filters.status !== 'all' && filters.status !== status) navigate('/findings')
  }

  const progress = (
    <div className="w-full sm:w-64" aria-live="polite">
      <p className="flex items-baseline justify-between text-[13px]">
        <span><span className="font-semibold tabular-nums text-foreground">{reviewed}</span> <span className="text-muted-foreground">{t('of')} <span className="tabular-nums">{findings.length}</span> {t('reviewed')}</span></span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </p>
      <Progress value={pct} className="mt-1.5 h-1.5" aria-label={t('Findings reviewed')} />
    </div>
  )

  return (
    <MotionConfig reducedMotion="user">
      <PageHeader title="Findings" subtitle="AI-assisted checks. The auditor decides, every time." actions={progress} />

      {allDone && !id ? (
        <div className="relative mx-auto max-w-xl pt-8">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="absolute top-0 left-1/2 z-10 -ml-8 rounded-full bg-background p-1.5">
            <span className="grid size-[52px] place-items-center rounded-full bg-sev-ok/10 text-sev-ok"><ShieldCheck className="size-7" aria-hidden /></span>
          </motion.span>
          <EmptyState title={`${t('All')} ${findings.length} ${t('findings reviewed')}`}
            body={t('Every item the AI flagged now has your decision. The quarterly Board report is ready to draft.')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="h-11 px-5 text-[15px]" onClick={() => navigate('/report')}>{t('Generate quarterly report')}</Button>
                <Button variant="ghost" className="h-11" onClick={() => { setFilters({ ...DEFAULT_FILTERS, status: 'all' }); const first = [...findings][0]; if (first) open(first.id) }}><ListChecks /> {t('Look back at decisions')}</Button>
              </div>
            } />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <aside data-tour="findings-list" className={cn('lg:sticky lg:top-4', id ? 'hidden lg:block' : 'block')}>
            <FindingList items={visible} counts={counts} divisions={divName} selectedId={selected?.id} filters={filters} setFilters={setFilters} onSelect={(fid) => open(fid)} />
          </aside>
          <div ref={paneRef} className={cn('min-w-0 scroll-mt-4', id ? 'block' : 'hidden lg:block')}>
            {selected
              ? <FindingDetail finding={selected} onDecide={(s, note) => s !== 'open' && decide(selected, s, note)} onBack={() => navigate('/findings')} />
              : <EmptyState title={t('Pick a finding')} body={t('Choose one from the list to see why the AI flagged it and what the evidence says.')} />}
          </div>
        </div>
      )}
    </MotionConfig>
  )
}
