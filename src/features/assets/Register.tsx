// Asset register: filters, issue chips, table (desktop) / cards (mobile).
import type { Dispatch, SetStateAction } from 'react'
import { CircleAlert, CircleCheck, CircleX, Clock, Search, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/kit'
import type { Asset } from '@/data/types'
import { cn, formatDate, formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { CATEGORY_ICON, ISSUE_LABEL, statusOf, type Issue, type Status } from './derive'

export const PAGE = 20
export interface Filters { q: string; loc: string; cat: string; status: string; issue: Issue | null; limit: number }
export const NO_FILTERS: Filters = { q: '', loc: 'all', cat: 'all', status: 'all', issue: null, limit: PAGE }

const STATUS: Record<Status, { label: string; icon: LucideIcon; cls: string }> = {
  verified: { label: 'Verified', icon: CircleCheck, cls: 'bg-sev-ok/10 text-sev-ok ring-sev-ok/20' },
  due: { label: 'Due for check', icon: Clock, cls: 'bg-muted text-muted-foreground ring-border' },
  damaged: { label: 'Damaged', icon: CircleAlert, cls: 'bg-sev-high/10 text-sev-high ring-sev-high/20' },
  missing: { label: 'Missing', icon: CircleX, cls: 'bg-sev-critical/10 text-sev-critical ring-sev-critical/20' },
}
const CATEGORIES = Object.keys(CATEGORY_ICON) as Asset['category'][]

function StatusChip({ status }: { status: Status }) {
  const t = useT()
  const { label, icon: I, cls } = STATUS[status]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset', cls)}>
      <I className="size-3.5" aria-hidden />{t(label)}
    </span>
  )
}
const LastVerified = ({ iso }: { iso?: string }) => {
  const t = useT()
  return iso ? <span className="tabular-nums">{formatDate(iso)}</span> : <span className="font-medium text-sev-medium">{t('Never')}</span>
}

const IssueNote = ({ issues = [] }: { issues?: Issue[] }) => {
  const t = useT()
  const shown = issues.filter((i) => i !== 'never') // "Never" already has its own column
  return shown.length ? <p className="mt-0.5 text-xs text-sev-medium">{shown.map((i) => t(ISSUE_LABEL[i])).join(' · ')}</p> : null
}

export function Register({ assets, issues, locations, f, setF }: {
  assets: Asset[]; issues: Map<string, Issue[]>; locations: string[]; f: Filters; setF: Dispatch<SetStateAction<Filters>>
}) {
  const t = useT()
  const q = f.q.trim().toLowerCase()
  const rows = assets.filter((a) =>
    (f.loc === 'all' || a.location === f.loc) && (f.cat === 'all' || a.category === f.cat) &&
    (f.status === 'all' || statusOf(a) === f.status || (f.status === 'flagged' && ['missing', 'damaged'].includes(statusOf(a)))) && (!f.issue || issues.get(a.id)?.includes(f.issue)) &&
    (!q || `${a.tag} ${a.name} ${a.assignedTo ?? ''} ${a.location}`.toLowerCase().includes(q)))
  const shown = rows.slice(0, f.limit)
  const set = (p: Partial<Filters>) => setF((s) => ({ ...s, ...p, limit: PAGE }))
  const issueCount = (i: Issue) => assets.filter((a) => issues.get(a.id)?.includes(i)).length
  const trigger = 'h-10 w-full sm:w-auto sm:min-w-40'

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('Search tag, name or person')} aria-label={t('Search assets')} className="h-10 pl-9" />
          </div>
          <Select value={f.loc} onValueChange={(loc) => set({ loc })}>
            <SelectTrigger className={trigger} aria-label={t('Location')}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('All locations')}</SelectItem>{locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.cat} onValueChange={(cat) => set({ cat })}>
            <SelectTrigger className={trigger} aria-label={t('Category')}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('All categories')}</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.status} onValueChange={(status) => set({ status })}>
            <SelectTrigger className={trigger} aria-label={t('Status')}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t('All statuses')}</SelectItem>{(Object.keys(STATUS) as Status[]).map((s) => <SelectItem key={s} value={s}>{t(STATUS[s].label)}</SelectItem>)}<SelectItem value="flagged">{t('Missing or damaged')}</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">{t('Needs attention:')}</span>
          {(Object.keys(ISSUE_LABEL) as Issue[]).map((i) => (
            <button key={i} type="button" aria-pressed={f.issue === i} onClick={() => set({ issue: f.issue === i ? null : i })}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                f.issue === i ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted')}>
              {t(ISSUE_LABEL[i])}<span className={cn('tabular-nums', f.issue === i ? 'text-background/70' : 'text-muted-foreground')}>{issueCount(i)}</span>
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <div className="p-4"><EmptyState title="No assets match these filters" body="Try a different location or clear the search."
          action={<Button variant="outline" className="h-10 px-4" onClick={() => setF(NO_FILTERS)}>{t('Clear filters')}</Button>} /></div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Tag', 'Asset', 'Location', 'Assigned to', 'Cost', 'Last verified', 'Status'].map((h) => (
                    <TableHead key={h} className={cn('px-4 text-[13px] text-muted-foreground', h === 'Cost' && 'text-right')}>{t(h)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => {
                  const I = CATEGORY_ICON[a.category]
                  return (
                    <TableRow key={a.id} className="h-14">
                      <TableCell className="px-4 font-mono text-[13px]">{a.tag}</TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-3">
                          <span title={a.category} className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><I className="size-4" aria-hidden /></span>
                          <div className="min-w-0"><p className="max-w-64 truncate font-medium">{a.name}</p><IssueNote issues={issues.get(a.id)} /></div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">{a.location}</TableCell>
                      <TableCell className="px-4 text-muted-foreground">{a.assignedTo ?? '—'}</TableCell>
                      <TableCell className="px-4 text-right tabular-nums">{formatINR(a.cost)}</TableCell>
                      <TableCell className="px-4"><LastVerified iso={a.lastVerified} /></TableCell>
                      <TableCell className="px-4"><StatusChip status={statusOf(a)} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {shown.map((a) => {
              const I = CATEGORY_ICON[a.category]
              return (
                <li key={a.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] text-muted-foreground">{a.tag}</span>
                    <StatusChip status={statusOf(a)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><I className="size-4" aria-hidden /></span>
                    <div className="min-w-0"><p className="truncate font-medium">{a.name}</p><IssueNote issues={issues.get(a.id)} /></div>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{a.location} · {a.assignedTo ?? t('Unassigned')}</p>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium tabular-nums">{formatINR(a.cost)}</span>
                    <span className="text-muted-foreground">{t('Last verified')}: <LastVerified iso={a.lastVerified} /></span>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4 text-[13px] text-muted-foreground">
            <span className="tabular-nums">{t('Showing')} {shown.length} {t('of')} {rows.length} {rows.length === 1 ? t('asset') : t('Assets')}</span>
            {rows.length > shown.length && (
              <Button variant="outline" className="h-10 px-4" onClick={() => setF((s) => ({ ...s, limit: s.limit + PAGE }))}>{t('Show')} {Math.min(PAGE, rows.length - shown.length)} {t('more')}</Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
