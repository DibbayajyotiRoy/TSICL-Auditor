import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Check, Search, SearchX } from 'lucide-react'
import type { Area, Finding, FindingStatus, Severity } from '@/data/types'
import { AREA_LABEL, SEVERITY_LABEL } from '@/data/types'
import { Confidence, EmptyState, SeverityBadge } from '@/components/kit'
import { BlurFade } from '@/components/ui/blur-fade'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { cn, formatINRShort } from '@/lib/utils'
import { SEV_ORDER, SEV_STYLE, STATUS_LABEL } from './shared'

export interface Filters { status: FindingStatus | 'all'; severities: Severity[]; area: Area | 'all'; q: string }
export const DEFAULT_FILTERS: Filters = { status: 'open', severities: [], area: 'all', q: '' }

const chip = (on: boolean) => cn(
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] lg:h-8',
  on ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground',
)

export function FindingList({ items, counts, divisions, selectedId, filters, setFilters, onSelect }: {
  items: Finding[] // already filtered + sorted
  counts: Record<FindingStatus | 'all', number>
  divisions: Map<string, string>
  selectedId?: string
  filters: Filters
  setFilters: (f: Filters) => void
  onSelect: (id: string) => void
}) {
  const t = useT()
  const set = (p: Partial<Filters>) => setFilters({ ...filters, ...p })
  const groups = SEV_ORDER.map((sev) => ({ sev, rows: items.filter((f) => f.severity === sev) })).filter((g) => g.rows.length)
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  // J/K moves selection; keep the row in view.
  useEffect(() => {
    if (selectedId) document.querySelector(`[data-row="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:max-h-[calc(100dvh-2rem)]">
      <div className="space-y-3 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('Search by title, division, document…')} aria-label={t('Search findings')} className="h-10 pl-9 md:h-9" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Filter by status')}>
          {(['all', 'open', 'confirmed', 'rejected', 'investigating'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filters.status === s} onClick={() => set({ status: s })} className={chip(filters.status === s)}>
              {s === 'all' ? t('All') : t(STATUS_LABEL[s])}
              <span className="tabular-nums opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Filter by severity')}>
          {SEV_ORDER.map((s) => {
            const on = filters.severities.includes(s)
            return (
              <button key={s} type="button" aria-pressed={on} className={chip(on)}
                onClick={() => set({ severities: on ? filters.severities.filter((x) => x !== s) : [...filters.severities, s] })}>
                <span className={cn('size-2 rounded-full', on ? 'bg-background' : SEV_STYLE[s].dot)} aria-hidden />
                {t(SEVERITY_LABEL[s])}
              </button>
            )
          })}
        </div>
        <Select value={filters.area} onValueChange={(v) => set({ area: v as Filters['area'] })}>
          <SelectTrigger aria-label={t('Filter by area')} className="h-10 w-full lg:h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All areas')}</SelectItem>
            {(Object.keys(AREA_LABEL) as Area[]).map((a) => <SelectItem key={a} value={a}>{t(AREA_LABEL[a])}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">J</kbd><kbd className="rounded border bg-muted px-1 font-mono text-[10px]">K</kbd> {t('to move')}
          <span aria-hidden>·</span> <span className="tabular-nums">{items.length}</span> {t('shown')}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {groups.length === 0 ? (
          <div className="p-3">
            <EmptyState title={t('Nothing matches')} body={t('Try a different filter or search word.')}
              action={dirty && <Button variant="outline" className="h-10" onClick={() => setFilters(DEFAULT_FILTERS)}><SearchX /> {t('Clear filters')}</Button>} />
          </div>
        ) : groups.map(({ sev, rows }) => (
          <section key={sev} aria-label={t(SEVERITY_LABEL[sev])}>
            <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-card/95 px-4 py-1.5 text-xs font-medium tracking-normal text-muted-foreground backdrop-blur">
              <span className={cn('size-2 rounded-full', SEV_STYLE[sev].dot)} aria-hidden />
              {t(SEVERITY_LABEL[sev])}
              <span className="tabular-nums">{rows.length}</span>
            </h3>
            <ul className="p-1.5">
              {rows.map((f, i) => {
                const sel = f.id === selectedId
                const row = (
                  <button type="button" data-row={f.id} aria-current={sel || undefined} onClick={() => onSelect(f.id)}
                    className="relative block min-h-14 w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2">
                    {sel && <motion.span layoutId="finding-pill" className="absolute inset-0 rounded-xl bg-muted ring-1 ring-border" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
                    <div className="relative flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <SeverityBadge severity={f.severity} className="h-5 px-2 text-[11px]" />
                          {f.status !== 'open' && (
                            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
                              <Check className="size-3" aria-hidden />{t(STATUS_LABEL[f.status])}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[14px] leading-snug font-medium tracking-tight text-foreground">{f.title}</p>
                        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">{divisions.get(f.divisionId) ?? f.divisionId}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0"><Confidence value={f.confidence} /></span>
                        </p>
                      </div>
                      <span className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-foreground">{f.amount > 0 ? formatINRShort(f.amount) : '—'}</span>
                    </div>
                  </button>
                )
                return <li key={f.id}>{i < 6 && sev === groups[0].sev ? <BlurFade delay={i * 0.03}>{row}</BlurFade> : row}</li>
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
