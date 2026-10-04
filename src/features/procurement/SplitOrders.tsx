import { useState } from 'react'
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { CircleCheck } from 'lucide-react'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatDate, formatINR, formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { SPLIT_LIMIT, type Cluster } from './analysis'
import { NoData, Section } from './parts'

const SHOW = 4
const DAY = 864e5
const config = { amount: { label: 'Order value', color: 'var(--sev-high)' } } satisfies ChartConfig
const dm = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

interface Pt { t: number; amount: number; z: number; id: string; date: string }

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="grid gap-0.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-mono text-muted-foreground">{p.id}</span>
      <span className="font-medium tabular-nums text-foreground">{formatINR(p.amount)}</span>
      <span className="text-muted-foreground">{formatDate(p.date)}</span>
    </div>
  )
}

function ClusterCard({ c, onOpen }: { c: Cluster; onOpen: (id: string) => void }) {
  const t = useT()
  const pts: Pt[] = c.pos.map((p) => ({ t: new Date(p.date).getTime(), amount: p.amount, z: 1, id: p.id, date: p.date }))
  const lo = pts[0].t - 3 * DAY, hi = pts[pts.length - 1].t + 3 * DAY
  const scale = Math.max(c.total, SPLIT_LIMIT) * 1.04
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="min-w-0 truncate text-[14px] font-medium text-foreground">{c.vendor}</h3>
        <span className="text-[13px] text-muted-foreground">{c.pos.length} {t('orders')} {t('in')} {c.spanDays} {c.spanDays === 1 ? t('day') : t('days')}</span>
      </div>

      <ChartContainer config={config} className="mt-2 aspect-auto h-[150px] w-full" role="img"
        aria-label={`${c.pos.length} orders from ${c.vendor}, each below ${formatINR(SPLIT_LIMIT)}, placed within ${c.spanDays} days`}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis type="number" dataKey="t" domain={[lo, hi]} ticks={pts.map((p) => p.t)} tickFormatter={dm} interval="preserveStartEnd" minTickGap={14} tickLine={false} axisLine={false} tickMargin={6} />
          <YAxis type="number" dataKey="amount" domain={[0, SPLIT_LIMIT * 1.3]} ticks={[0, SPLIT_LIMIT / 2, SPLIT_LIMIT]} tickFormatter={(v: number) => (v === 0 ? '₹0' : formatINRShort(v))} width={48} tickLine={false} axisLine={false} />
          <ZAxis dataKey="z" range={[110, 110]} />
          <ReferenceLine y={SPLIT_LIMIT} stroke="var(--foreground)" strokeOpacity={0.55}
            label={{ value: t('Tender limit'), position: 'insideTopRight', dy: -14, fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <ChartTooltip cursor={false} content={<Tip />} />
          <Scatter data={pts} fill="var(--color-amount)" stroke="var(--card)" strokeWidth={2} isAnimationActive={false} />
        </ScatterChart>
      </ChartContainer>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
        <span className="font-semibold tabular-nums text-foreground">{formatINR(c.total)} <span className="font-normal text-muted-foreground">{t('together')}</span></span>
        <span className="text-xs text-muted-foreground">{t('Limit')} {formatINR(SPLIT_LIMIT)}</span>
      </div>
      <div className="relative mt-1.5 h-6" role="img" aria-label={`Combined ${formatINR(c.total)} against the ${formatINR(SPLIT_LIMIT)} limit`}>
        <div className="absolute inset-x-0 top-1.5 flex h-3 gap-0.5">
          {c.pos.map((p) => <div key={p.id} className="h-full rounded-[3px] bg-sev-high first:rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `calc(${(p.amount / scale) * 100}% - 1px)` }} />)}
        </div>
        <div className="absolute top-0 h-6 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${(SPLIT_LIMIT / scale) * 100}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.pos.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpen(p.id)}
            className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 px-2 font-mono text-xs text-foreground/80 transition-colors hover:bg-muted hover:text-foreground">
            {p.id}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Same vendor, orders <= 15 days apart, each under the tender limit, together over it. */
export function SplitOrders({ clusters, onOpen }: { clusters: Cluster[]; onOpen: (id: string) => void }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const shown = all ? clusters : clusters.slice(0, SHOW)
  return (
    <Section title="Possible order splitting" caption="Large purchases broken into smaller orders can avoid tender rules.">
      {clusters.length === 0 ? (
        <NoData><CircleCheck className="size-4 text-sev-ok" aria-hidden />{t('No group of small orders adds up to more than')} {formatINR(SPLIT_LIMIT)}.</NoData>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">{shown.map((c) => <ClusterCard key={c.vendor + c.pos[0].id} c={c} onOpen={onOpen} />)}</div>
          {clusters.length > SHOW && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 h-10 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {all ? t('Show fewer') : `${t('Show all')} ${clusters.length} ${t('groups')}`}
            </button>
          )}
        </>
      )}
    </Section>
  )
}
