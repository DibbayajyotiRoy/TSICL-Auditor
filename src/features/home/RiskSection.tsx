import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'motion/react'
import { AiInsight, EmptyState, SeverityBadge } from '@/components/kit'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { SEVERITY_LABEL } from '@/data/types'
import { useT } from '@/lib/i18n'
import { formatINRShort } from '@/lib/utils'
import { SEV_RANK, SEV_VAR, type AreaRow, type HomeStats } from './stats'

function Tip({ active, payload }: { active?: boolean; payload?: { payload: AreaRow }[] }) {
  const t = useT()
  const r = active ? payload?.[0]?.payload : undefined
  if (!r) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2.5 text-[13px] shadow-lg">
      <p className="font-medium text-foreground">{t(r.label)}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">{r.count} {t('open')} {t(r.count === 1 ? 'issue' : 'issues')} · {formatINRShort(r.amount)}</p>
      <div className="mt-2"><SeverityBadge severity={r.worst} /></div>
    </div>
  )
}

export function RiskSection({ s }: { s: HomeStats }) {
  const t = useT()
  const reduce = useReducedMotion()
  const { areas } = s
  const total = areas.reduce((a, r) => a + r.amount, 0)
  const top = [...areas].sort((a, b) => b.amount - a.amount)[0]
  const sevs = [...new Set(areas.map((r) => r.worst))].sort((a, b) => SEV_RANK[a] - SEV_RANK[b])
  const rows = areas.map((r) => ({ ...r, label: t(r.label) }))

  return (
    <div className="flex flex-col gap-4">
      <AiInsight ask="Summarise the biggest risks this quarter in simple words">
        {top ? (
          <>
            <span className="font-medium text-foreground">{total ? Math.round((100 * top.amount) / total) : 0}% {t('of the money at risk')}</span> {t('sits in')}{' '}
            <span className="font-medium text-foreground">{t(top.label)}</span> — {formatINRShort(top.amount)} {t('across')} {top.count} {t(top.count === 1 ? 'issue' : 'issues')}.
            {areas.length > 1 && ` ${areas.length - 1} ${t(areas.length === 2 ? 'other area also has' : 'other areas also have')} ${t('open issues.')}`}
          </>
        ) : t('No open issues right now. The assistant keeps checking every new document as it arrives.')}
      </AiInsight>

      <section className="flex-1 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{t('Where the risk is')}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t('Open issues by area. Colour shows the most serious one in each area.')}</p>

        {areas.length === 0 ? (
          <div className="mt-4"><EmptyState title={t('No open issues')} body={t('Every area looks clean for now.')} /></div>
        ) : (
          <>
            <ChartContainer config={{ count: { label: t('Open issues') } } satisfies ChartConfig} className="mt-4 aspect-auto w-full" style={{ height: rows.length * 52 + 8 }}
              role="img" aria-label={`${t('Open issues by area')}: ${rows.map((r) => `${r.label} ${r.count}`).join(', ')}`}>
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 76, bottom: 4, left: 0 }} barCategoryGap={14}>
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis dataKey="label" type="category" width={132} tickLine={false} axisLine={false} interval={0} tick={{ fill: 'var(--foreground)', fontSize: 13 }} />
                <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<Tip />} />
                <Bar dataKey="count" radius={6} maxBarSize={26} isAnimationActive={!reduce} animationDuration={600}>
                  {rows.map((r) => <Cell key={r.area} fill={SEV_VAR[r.worst]} />)}
                  <LabelList dataKey="tag" content={({ x, y, width, height, index }) => (
                    <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dy="0.35em" fontSize={12} fill="var(--foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>{rows[Number(index)]?.tag}</text>
                  )} />
                </Bar>
              </BarChart>
            </ChartContainer>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {sevs.map((v) => (
                <li key={v} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: SEV_VAR[v] }} aria-hidden />{t(SEVERITY_LABEL[v])}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
