import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { EmptyState } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAudit } from '@/data/store'
import { cn, formatDate, formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { IssueKey, PoRow } from './analysis'
import { IssueChip, ISSUE, ISSUE_ORDER, Section } from './parts'

const PAGE = 15
type Sort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
const SORT_LABEL: Record<Sort, string> = { date_desc: 'Newest first', date_asc: 'Oldest first', amount_desc: 'Highest amount', amount_asc: 'Lowest amount' }

function SortHead({ k, label, sort, onToggle, className }: { k: 'date' | 'amount'; label: string; sort: Sort; onToggle: (k: 'date' | 'amount') => void; className?: string }) {
  const on = sort.startsWith(k)
  const Icon = !on ? ArrowUpDown : sort.endsWith('asc') ? ArrowUp : ArrowDown
  return (
    <TableHead className={className} aria-sort={on ? (sort.endsWith('asc') ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onToggle(k)} className={cn('inline-flex h-8 items-center gap-1 rounded-md px-1 hover:text-foreground', on ? 'text-foreground' : 'text-muted-foreground')}>
        {label}<Icon className="size-3.5" aria-hidden />
      </button>
    </TableHead>
  )
}

export type IssueFilter = IssueKey | 'all'

export function PoTable({ rows, issue, setIssue, query, onQuery, onOpen }: { rows: PoRow[]; issue: IssueFilter; setIssue: (i: IssueFilter) => void; query: string; onQuery: (q: string) => void; onOpen: (id: string) => void }) {
  const t = useT()
  const divisions = useAudit((s) => s.divisions)
  const [div, setDiv] = useState('all')
  const [sort, setSort] = useState<Sort>('date_desc')
  const [limit, setLimit] = useState(PAGE)
  const divName = (id: string) => divisions.find((d) => d.id === id)?.name ?? id
  const reset = () => setLimit(PAGE)

  const counts = useMemo(() => {
    const c: Record<IssueKey, number> = { above_limit: 0, one_quote: 0, paid_early: 0, invoice_over: 0, split: 0 }
    for (const r of rows) for (const i of r.issues) c[i]++
    return c
  }, [rows])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const out = rows.filter(({ po, issues }) =>
      (div === 'all' || po.divisionId === div) &&
      (issue === 'all' || issues.includes(issue)) &&
      (!needle || `${po.id} ${po.vendor} ${po.item}`.toLowerCase().includes(needle)))
    const [key, dir] = sort.split('_') as ['date' | 'amount', 'asc' | 'desc']
    out.sort((a, b) => (key === 'date' ? a.po.date.localeCompare(b.po.date) : a.po.amount - b.po.amount) * (dir === 'asc' ? 1 : -1))
    return out
  }, [rows, query, div, issue, sort])

  const toggle = (key: 'date' | 'amount') => setSort(sort === `${key}_desc` ? `${key}_asc` : `${key}_desc`)

  const clear = () => { onQuery(''); setDiv('all'); setIssue('all'); reset() }
  const filtered = query || div !== 'all' || issue !== 'all'

  return (
    <Section id="all-purchases" title="All purchases" caption="Tap any purchase to see its journey from order to payment." className="scroll-mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => { onQuery(e.target.value); reset() }} placeholder={t('Search order number, vendor or item')} aria-label={t('Search purchases')} className="h-10 rounded-lg pl-9" />
        </div>
        <Select value={div} onValueChange={(v) => { setDiv(v); reset() }}>
          <SelectTrigger className="h-10 w-full sm:w-52" aria-label={t('Filter by division')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All divisions')}</SelectItem>
            {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="h-10 w-full sm:w-44 lg:hidden" aria-label={t('Sort purchases')}><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(SORT_LABEL) as Sort[]).map((s) => <SelectItem key={s} value={s}>{t(SORT_LABEL[s])}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('Filter by issue')}>
        {(['all', ...ISSUE_ORDER] as IssueFilter[]).map((k) => {
          const on = issue === k
          const n = k === 'all' ? rows.length : counts[k]
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => { setIssue(k); reset() }}
              className={cn('inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors sm:h-8',
                on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground/80 hover:bg-muted')}>
              {k === 'all' ? t('Everything') : t(ISSUE[k].label)}
              <span className={cn('tabular-nums', on ? 'text-background/70' : 'text-muted-foreground')}>{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={rows.length ? 'No purchases match these filters' : 'No purchases loaded yet'} body={rows.length ? 'Try a different search or clear the filters.' : 'Purchase orders will appear here once documents are received.'}
            action={filtered ? <Button variant="outline" className="h-10" onClick={clear}><X />{t('Clear filters')}</Button> : undefined} />
        </div>
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="mt-4 hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground">{t('Purchase')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('Vendor')}</TableHead>
                  <SortHead k="date" label={t('Date')} sort={sort} onToggle={toggle} />
                  <SortHead k="amount" label={t('Amount')} sort={sort} onToggle={toggle} className="text-right [&>button]:flex-row-reverse" />
                  <TableHead className="text-muted-foreground">{t('Issues')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.slice(0, limit).map(({ po, issues }) => (
                  <TableRow key={po.id} onClick={() => onOpen(po.id)} className="cursor-pointer">
                    <TableCell className="py-3 whitespace-normal">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(po.id) }} className="block rounded-md text-left font-mono text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring">{po.id}</button>
                      <span className="block max-w-[200px] truncate text-xs text-muted-foreground">{po.item}</span>
                    </TableCell>
                    <TableCell className="py-3 whitespace-normal">
                      <span className="block text-[13px] text-foreground">{po.vendor}</span>
                      <span className="block text-xs text-muted-foreground">{divName(po.divisionId)}</span>
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-muted-foreground">{formatDate(po.date)}</TableCell>
                    <TableCell className="py-3 text-right text-[13px] font-medium tabular-nums text-foreground">{formatINR(po.amount)}</TableCell>
                    <TableCell className="py-3 whitespace-normal">
                      {issues.length ? <div className="flex flex-wrap gap-1">{issues.map((i) => <IssueChip key={i} issue={i} />)}</div> : <span className="text-xs text-muted-foreground">{t('No issues')}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Small screens: cards */}
          <ul className="mt-4 space-y-2 lg:hidden">
            {shown.slice(0, limit).map(({ po, issues }) => (
              <li key={po.id}>
                <button type="button" onClick={() => onOpen(po.id)} className="block w-full rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[13px] font-medium text-foreground">{po.id}</span>
                    <span className="text-[15px] font-semibold tabular-nums text-foreground">{formatINR(po.amount)}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-foreground">{po.vendor}</p>
                  <p className="text-xs text-muted-foreground">{po.item} · {divName(po.divisionId)} · {formatDate(po.date)}</p>
                  {issues.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1">{issues.map((i) => <IssueChip key={i} issue={i} />)}</div>}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span className="tabular-nums">{t('Showing')} {Math.min(limit, shown.length)} {t('of')} {shown.length} {shown.length === 1 ? t('purchase') : t('Purchases')}</span>
            {shown.length > limit && <Button variant="outline" className="h-10" onClick={() => setLimit(limit + PAGE)}>{t('Show')} {Math.min(PAGE, shown.length - limit)} {t('more')}</Button>}
          </div>
        </>
      )}
    </Section>
  )
}
