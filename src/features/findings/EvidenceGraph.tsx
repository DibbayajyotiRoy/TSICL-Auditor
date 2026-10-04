import { motion, useReducedMotion } from 'motion/react'
import type { EvidenceRef, Finding, Rule } from '@/data/types'
import { useAudit } from '@/data/store'
import { Confidence } from '@/components/kit'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useT } from '@/lib/i18n'
import { cn, formatDate, formatINR } from '@/lib/utils'
import { byTrail, KIND_LABEL, SEV_STYLE } from './shared'

type Box = { x: number; y: number; w: number; h: number } // centre-based

/** Which document is the culprit? Keyword guess on the rule text.
 *  ponytail: heuristic; add a `culprit` field to Rule/Finding when the engine can say it exactly. */
const CULPRIT: [RegExp, EvidenceRef['kind'][]][] = [
  [/approv|authority|power|limit|split/, ['approval_note', 'purchase_order']],
  [/quot|tender|compet|single|vendor/, ['quotation', 'purchase_order']],
  [/invoice|duplicate|exceed|excess|payment|paid/, ['invoice', 'payment_voucher']],
  [/receiv|overdue|outstanding|ageing|owed|unmatched/, ['ledger', 'bank', 'bank_statement']],
  [/asset|verif|missing|register/, ['asset_register', 'register']],
]
function culpritIndex(nodes: EvidenceRef[], f: Finding, rule?: Rule) {
  const text = `${rule?.name ?? ''} ${f.title} ${f.reason}`.toLowerCase()
  for (const [re, kinds] of CULPRIT) if (re.test(text)) for (const k of kinds) { const i = nodes.findIndex((n) => n.kind === k); if (i >= 0) return i }
  return 0
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
function wrap(s: string, n: number) {
  const lines: string[] = []
  for (const w of s.split(' ')) (lines.length && `${lines[lines.length - 1]} ${w}`.length <= n ? (lines[lines.length - 1] += ` ${w}`) : lines.push(w))
  return lines.slice(0, 2).map((l, i, a) => (i === 1 && lines.length > 2 && a.length === 2 ? clip(`${l}…`, n) : clip(l, n)))
}

function build(n: number, v: boolean) {
  const W = v ? 340 : 720
  const H = v ? n * 64 + 4 : 232
  const nw = v ? 152 : n > 1 ? Math.max(88, Math.min(132, 576 / (n - 1) - 30)) : 132
  const nh = v ? 46 : 52
  const rule: Box = v ? { x: 262, y: H / 2, w: 120, h: 76 } : { x: 360, y: 190, w: 250, h: 52 }
  const nodes: Box[] = Array.from({ length: n }, (_, i) => (v ? { x: 86, y: 34 + i * 64, w: nw, h: nh } : { x: n > 1 ? 72 + (i * 576) / (n - 1) : 360, y: 44, w: nw, h: nh }))
  const chain = nodes.slice(1).map((b, i) => {
    const a = nodes[i]
    return v
      ? `M${a.x} ${a.y + a.h / 2}V${b.y - b.h / 2}M${b.x - 4} ${b.y - b.h / 2 - 5}L${b.x} ${b.y - b.h / 2}L${b.x + 4} ${b.y - b.h / 2 - 5}`
      : `M${a.x + a.w / 2} ${a.y}H${b.x - b.w / 2}M${b.x - b.w / 2 - 5} ${a.y - 4}L${b.x - b.w / 2} ${a.y}L${b.x - b.w / 2 - 5} ${a.y + 4}`
  })
  const links = nodes.map((a, i) => {
    if (v) {
      const sx = a.x + a.w / 2, sy = a.y, ex = rule.x - rule.w / 2, ey = n > 1 ? rule.y - 26 + (i * 52) / (n - 1) : rule.y, xm = (sx + ex) / 2
      return { d: `M${sx} ${sy}C${xm} ${sy} ${xm} ${ey} ${ex} ${ey}`, mx: (sx + 6 * xm + ex) / 8, my: (sy + ey) / 2 }
    }
    const sy = a.y + a.h / 2, ey = rule.y - rule.h / 2, tx = n > 1 ? rule.x - 85 + (i * 170) / (n - 1) : rule.x, ym = (sy + ey) / 2
    return { d: `M${a.x} ${sy}C${a.x} ${ym} ${tx} ${ym} ${tx} ${ey}`, mx: (a.x + tx) / 2, my: (sy + 6 * ym + ey) / 8 }
  })
  return { W, H, rule, nodes, chain, links }
}

function Graph({ vertical, nodes, rule, f, culprit, onOpen }: {
  vertical: boolean; nodes: EvidenceRef[]; rule?: Rule; f: Finding; culprit: number; onOpen: (e: EvidenceRef) => void
}) {
  const reduce = useReducedMotion()
  const tr = useT()
  const g = build(nodes.length, vertical)
  const sev = SEV_STYLE[f.severity]
  const t = (delay: number, d = 0.55) => ({ duration: reduce ? 0 : d, delay: reduce ? 0 : delay, ease: 'easeOut' as const })
  const draw = (delay: number) => ({ initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: t(delay) })
  const pill = !vertical && g.links[culprit]
  const ruleName = vertical ? wrap(rule?.name ?? f.title, 15) : [clip(rule?.name ?? f.title, 34)]
  return (
    <svg viewBox={`0 0 ${g.W} ${g.H}`} className={cn('h-auto w-full', vertical ? 'mx-auto max-w-[340px] @lg:hidden' : 'hidden @lg:block')} role="group" aria-label={tr('Evidence graph')}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
        {g.chain.map((d, i) => <motion.path key={i} d={d} className="stroke-muted-foreground/40" {...draw(0.1 + i * 0.08)} />)}
        {g.links.map((l, i) => i !== culprit && <motion.path key={i} d={l.d} className="stroke-border" strokeWidth={1.25} {...draw(0.35 + i * 0.05)} />)}
        <motion.path d={g.links[culprit].d} className={sev.stroke} strokeWidth={2.25} {...draw(0.6)} />
      </g>
      {pill && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(1.05, 0.25)}>
          <rect x={pill.mx - 50} y={pill.my - 11} width={100} height={22} rx={11} className={cn('fill-card', sev.stroke)} strokeWidth={1.25} />
          <text x={pill.mx} y={pill.my + 4} textAnchor="middle" className={cn('text-[11px] font-medium', sev.fill)} stroke="none">{tr('Breaks the rule')}</text>
        </motion.g>
      )}
      {nodes.map((ev, i) => {
        const b = g.nodes[i]
        const hot = i === culprit
        return (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(i * 0.06, 0.3)} role="button" tabIndex={0}
            aria-label={`${tr(KIND_LABEL[ev.kind])} ${ev.label}. ${tr('Show what was read from it.')}`} className="group cursor-pointer outline-none"
            onClick={() => onOpen(ev)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(ev) } }}>
            <rect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h} rx={12} strokeWidth={hot ? 1.75 : 1}
              className={cn('fill-card transition-colors duration-150 group-focus-visible:stroke-ring group-focus-visible:stroke-2', hot ? sev.stroke : 'stroke-border group-hover:stroke-foreground/30')} />
            <text x={b.x} y={b.y - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">{clip(tr(KIND_LABEL[ev.kind]), Math.floor(b.w / 6.4))}</text>
            <text x={b.x} y={b.y + 13} textAnchor="middle" className="fill-foreground font-mono text-[12px] font-medium">{clip(ev.label, Math.floor(b.w / 7.4))}</text>
            {hot && <circle cx={b.x + b.w / 2 - 9} cy={b.y - b.h / 2 + 9} r={4} className={sev.fill} />}
          </motion.g>
        )
      })}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.5, 0.3)}>
        <rect x={g.rule.x - g.rule.w / 2} y={g.rule.y - g.rule.h / 2} width={g.rule.w} height={g.rule.h} rx={12} strokeWidth={1.75} className={cn('fill-muted', sev.stroke)} />
        <text x={g.rule.x} y={g.rule.y - (ruleName.length > 1 ? 18 : 6)} textAnchor="middle" className="fill-muted-foreground text-[10.5px]">{tr('Audit rule')} {rule?.id ?? ''}</text>
        {ruleName.map((l, i) => <text key={i} x={g.rule.x} y={g.rule.y + (ruleName.length > 1 ? 0 : 12) + i * 15} textAnchor="middle" className="fill-foreground text-[12.5px] font-semibold">{l}</text>)}
      </motion.g>
    </svg>
  )
}

const MONEY = /amount|value|total|price|cost|limit|rate|paid|balance/i
const humanize = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
const show = (k: string, v: string | number) => (typeof v === 'number' && MONEY.test(k) ? formatINR(v) : String(v))

export function DocSheet({ ev, onClose }: { ev: EvidenceRef | null; onClose: () => void }) {
  const t = useT()
  const documents = useAudit((s) => s.documents)
  const pos = useAudit((s) => s.purchaseOrders)
  const divisions = useAudit((s) => s.divisions)
  const doc = ev?.docId ? documents.find((d) => d.id === ev.docId) : undefined
  const po = !doc && ev ? pos.find((p) => p.id === ev.label) : undefined
  const rows: [string, string][] = doc
    ? Object.entries(doc.fields).map(([k, v]) => [humanize(k), show(k, v)])
    : po ? [['Vendor', po.vendor], ['Item', po.item], ['Amount', formatINR(po.amount)], ['Date', formatDate(po.date)], ['Approved by', po.approvedBy], ['Approver’s limit', formatINR(po.approverLimit)], ['Quotations received', String(po.quotations)], ...(po.invoiceNo ? [['Invoice number', po.invoiceNo] as [string, string]] : []), ...(po.invoiceAmount ? [['Invoice amount', formatINR(po.invoiceAmount)] as [string, string]] : []), ...(po.paymentDate ? [['Paid on', formatDate(po.paymentDate)] as [string, string]] : [])]
      : []
  const div = doc && divisions.find((d) => d.id === doc.divisionId)
  return (
    <Sheet open={!!ev} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {ev && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="text-lg tracking-tight">{t(KIND_LABEL[ev.kind])}</SheetTitle>
              <SheetDescription className="font-mono">{ev.label}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-8">
              {doc && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span>{doc.name}</span><span aria-hidden>·</span>
                  <span>{doc.pages} {t(doc.pages === 1 ? 'page' : 'pages')}</span><span aria-hidden>·</span>
                  <span>{t('Received')} {formatDate(doc.receivedAt)}</span>
                  {div && <><span aria-hidden>·</span><span>{div.name}</span></>}
                </div>
              )}
              {rows.length > 0 ? (
                <section>
                  <h4 className="mb-1 text-[13px] font-medium text-muted-foreground">{t('What the assistant read from this document')}</h4>
                  <dl className="divide-y divide-border rounded-xl border border-border">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
                        <dt className="text-[13px] text-muted-foreground">{k}</dt>
                        <dd className="text-right text-[14px] font-medium tabular-nums text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("We don't have a scanned copy of this")} {t(KIND_LABEL[ev.kind]).toLowerCase()} {t('yet. The assistant is relying on the entry')} <span className="font-mono text-foreground">{ev.label}</span> {t('in the records.')}
                </p>
              )}
              {doc && <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">{t('How sure the assistant is about the reading')}</span><Confidence value={doc.confidence} /></div>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** The SVG paper-trail graph. Secondary view: the parent decides when it is shown. */
export function EvidenceChain({ finding, rule, onOpen }: { finding: Finding; rule?: Rule; onOpen: (e: EvidenceRef) => void }) {
  const t = useT()
  const nodes = [...finding.evidence].sort(byTrail)
  const culprit = culpritIndex(nodes, finding, rule)
  return (
    <div className="@container">
      <p className="mb-3 text-[13px] text-muted-foreground">{t('Follow the paper trail left to right. The highlighted line shows where it breaks the rule. Tap any document to see what was read from it.')}</p>
      {nodes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('No documents are linked to this finding yet.')}</p>
      ) : (
        <>
          <Graph vertical={false} nodes={nodes} rule={rule} f={finding} culprit={culprit} onOpen={onOpen} />
          <Graph vertical nodes={nodes} rule={rule} f={finding} culprit={culprit} onOpen={onOpen} />
        </>
      )}
    </div>
  )
}
