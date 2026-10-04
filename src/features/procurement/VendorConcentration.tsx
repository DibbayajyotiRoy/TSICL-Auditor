import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { CONCENTRATION_PCT, type VendorShare } from './analysis'
import { NoData, Section } from './parts'

const TOP = 6
const short = (s: string) => (s.length > 19 ? s.slice(0, 18) + '…' : s)

function Tip({ active, payload }: { active?: boolean; payload?: { payload: VendorShare }[] }) {
  const t = useT()
  const v = payload?.[0]?.payload
  if (!active || !v) return null
  return (
    <div className="grid gap-0.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-medium text-foreground">{v.vendor}</span>
      <span className="tabular-nums text-foreground">{v.pct.toFixed(1)}% {t('of spend')} · {formatINRShort(v.amount)}</span>
      <span className="text-muted-foreground">{v.orders} {v.orders === 1 ? t('order') : t('orders')}</span>
    </div>
  )
}

/** Emphasis form: every bar grey, any vendor above 25% in the "important" colour. */
export function VendorConcentration({ vendors, onPick }: { vendors: VendorShare[]; onPick?: (vendor: string) => void }) {
  const t = useT()
  const top = vendors.slice(0, TOP)
  const heavy = top.filter((v) => v.pct > CONCENTRATION_PCT)
  const config = { pct: { label: t('Share of spend'), color: 'var(--muted-foreground)' } } satisfies ChartConfig
  return (
    <Section title="Vendor concentration" caption="Who we spend the most with. Relying on one supplier can hide pricing problems.">
      {top.length === 0 ? (
        <NoData>{t('No purchases to chart yet.')}</NoData>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-[2px] bg-muted-foreground/50" />{t('Share of total spend')}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-[2px] bg-sev-high" />{t('Above')} {CONCENTRATION_PCT}%</span>
          </div>
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: top.length * 40 + 12 }}>
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 0 }}>
              <YAxis type="category" dataKey="vendor" width={124} tickLine={false} axisLine={false} tickFormatter={short} interval={0} />
              <XAxis type="number" hide domain={[0, Math.max(30, Math.ceil(top[0].pct / 5) * 5)]} />
              <ReferenceLine x={CONCENTRATION_PCT} stroke="var(--foreground)" strokeOpacity={0.4} />
              <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<Tip />} />
              <Bar dataKey="pct" barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {top.map((v) => <Cell key={v.vendor} fill={v.pct > CONCENTRATION_PCT ? 'var(--sev-high)' : 'var(--muted-foreground)'} fillOpacity={v.pct > CONCENTRATION_PCT ? 1 : 0.5} />)}
                <LabelList dataKey="pct" position="right" fontSize={12} className="fill-foreground tabular-nums" formatter={(v) => `${Number(v).toFixed(1)}%`} />
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {heavy.length
              ? <>{heavy.map((v) => `${v.vendor} (${v.pct.toFixed(0)}%)`).join(', ')} {heavy.length === 1 ? t('takes') : t('take')} {t('more than a quarter of all purchase spend.')}</>
              : <>{t('No single vendor takes more than a quarter of the spend.')}</>}
          </p>
          {onPick && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("Show a vendor's purchases")}>
              {top.map((v) => (
                <button key={v.vendor} type="button" onClick={() => onPick(v.vendor)}
                  aria-label={`${v.vendor}: ${t('show their purchases below')}`}
                  className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border px-3 text-xs text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                  <span className="max-w-40 truncate font-medium">{v.vendor}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{v.pct.toFixed(0)}%</span>
                </button>
              ))}
            </div>
          )}
          <table className="sr-only">
            <caption>{t('Share of purchase spend by vendor')}</caption>
            <tbody>{top.map((v) => <tr key={v.vendor}><th scope="row">{v.vendor}</th><td>{v.pct.toFixed(1)}%</td></tr>)}</tbody>
          </table>
        </>
      )}
    </Section>
  )
}
