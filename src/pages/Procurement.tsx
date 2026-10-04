import { useMemo, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { AiInsight, EmptyState, KpiCard, PageHeader } from '@/components/kit'
import { BlurFade } from '@/components/ui/blur-fade'
import { useAudit } from '@/data/store'
import { formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { analyse, CONCENTRATION_PCT, SPLIT_LIMIT } from '@/features/procurement/analysis'
import { ApprovalLimits } from '@/features/procurement/ApprovalLimits'
import { PoSheet } from '@/features/procurement/PoSheet'
import { PoTable, type IssueFilter } from '@/features/procurement/PoTable'
import { ISSUE } from '@/features/procurement/parts'
import { SplitOrders } from '@/features/procurement/SplitOrders'
import { VendorConcentration } from '@/features/procurement/VendorConcentration'

export default function Procurement() {
  const t = useT()
  const pos = useAudit((s) => s.purchaseOrders)
  const reduce = useReducedMotion()
  const { rows, clusters, vendors, total, over } = useMemo(() => analyse(pos), [pos])
  const [issue, setIssue] = useState<IssueFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const oneQuote = rows.filter((r) => r.issues.includes('one_quote'))
  const flagged = rows.filter((r) => r.issues.length > 0).length
  const overTotal = over.reduce((s, r) => s + r.overBy, 0)
  const heavy = vendors.find((v) => v.pct > CONCENTRATION_PCT)
  const worst = [...rows].sort((a, b) => b.issues.length - a.issues.length || b.po.amount - a.po.amount)[0]

  const jump = (f: IssueFilter) => {
    setIssue(f)
    document.getElementById('all-purchases')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const pickVendor = (vendor: string) => {
    setQuery(vendor)
    document.getElementById('all-purchases')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  // Plain-language takeaway, computed from the same numbers shown on the page.
  const takeaway = (
    <>
      {over.length > 0 && <><strong>{over.length} {over.length === 1 ? t('purchase') : t('Purchases')}</strong> {over.length === 1 ? t('was') : t('were')} {t("approved above the officer's limit")}, {formatINR(overTotal)} {t('beyond what they were allowed to sign')}. {t('The largest is')} <button type="button" onClick={() => setOpenId(over[0].po.id)} className="font-mono font-semibold underline decoration-dotted underline-offset-2 hover:text-foreground">{over[0].po.id}</button> ({over[0].po.vendor}, {formatINR(over[0].overBy)} {t('over')}). </>}
      {clusters.length > 0 && <>{clusters.length} {clusters.length === 1 ? t('vendor group') : t('vendor groups')} {t('placed several small orders close together that add up to more than')} {formatINR(SPLIT_LIMIT)}, {t('which may be splitting to avoid tender rules')}. </>}
      {heavy && <>{heavy.vendor} {t('receives')} {heavy.pct.toFixed(0)}% {t('of all spend')}. </>}
      {worst && worst.issues.length > 1 && <>{worst.po.id} {t('carries the most warning signs')}: {worst.issues.map((i) => t(ISSUE[i].label)).join(', ')}.</>}
      {!over.length && !clusters.length && !heavy && !(worst && worst.issues.length > 1) && <>{t("Nothing stands out in this quarter's purchases.")}</>}
    </>
  )

  const fade = (i: number, node: ReactNode, className?: string) => <BlurFade delay={0.04 * i} duration={0.35} className={className}>{node}</BlurFade>

  return (
    <div>
      <PageHeader title="Purchases & Work Orders" subtitle="Every purchase this quarter, checked against who is allowed to approve what." />

      {rows.length === 0 ? (
        <EmptyState title="No purchases to check yet" body="Once purchase orders arrive in the inbox, they are checked here automatically." />
      ) : (
        <div className="space-y-6">
          <div data-tour="kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total purchases" value={total} format="inr" hint={`${t('Across')} ${rows.length} ${rows.length === 1 ? t('purchase order') : t('purchase orders')}`} onClick={() => jump('all')} />
            <KpiCard label="Purchases checked" value={rows.length} hint={flagged ? `${flagged} ${t('need a closer look')}` : 'All clear'} tone={flagged ? 'warn' : 'good'} onClick={() => jump('all')} />
            <KpiCard label="Approved above limit" value={over.length} hint={over.length ? `${formatINR(overTotal)} ${t('over allowed limits')}` : 'None this quarter'} tone={over.length ? 'bad' : 'good'} onClick={() => jump('above_limit')} />
            <KpiCard label="Single-quote purchases" value={oneQuote.length} hint={oneQuote.length ? `${formatINR(oneQuote.reduce((s, r) => s + r.po.amount, 0))} ${t('bought without a price comparison')}` : 'Every purchase compared prices'} tone={oneQuote.length ? 'warn' : 'good'} onClick={() => jump('one_quote')} />
          </div>

          {fade(1, <AiInsight ask="Which purchases look most suspicious and why?">{takeaway}</AiInsight>, 'overflow-hidden rounded-2xl')}

          <div className="grid gap-6 lg:grid-cols-5">
            {fade(2, <ApprovalLimits over={over} onOpen={setOpenId} />, 'lg:col-span-3 [&>section]:h-full')}
            {fade(3, <VendorConcentration vendors={vendors} onPick={pickVendor} />, 'lg:col-span-2 [&>section]:h-full')}
          </div>

          {fade(4, <SplitOrders clusters={clusters} onOpen={setOpenId} />)}
          {fade(5, <PoTable rows={rows} issue={issue} setIssue={setIssue} query={query} onQuery={setQuery} onOpen={setOpenId} />)}
        </div>
      )}

      <PoSheet row={rows.find((r) => r.po.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </div>
  )
}
