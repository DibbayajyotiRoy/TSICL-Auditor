// Pure purchase analysis. No runtime imports from the app so `node analysis.check.ts` can run it.
import type { Finding, PurchaseOrder } from '@/data/types'

export const SPLIT_LIMIT = 200_000 // each order below this, together above it
export const SPLIT_DAYS = 15
export const CONCENTRATION_PCT = 25

export type IssueKey = 'above_limit' | 'one_quote' | 'paid_early' | 'invoice_over' | 'split'

export interface PoRow {
  po: PurchaseOrder
  issues: IssueKey[]
  overBy: number // amount above approver limit, 0 if within
}
export interface Cluster { vendor: string; pos: PurchaseOrder[]; total: number; spanDays: number }
export interface VendorShare { vendor: string; amount: number; pct: number; orders: number }

const day = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5)

export const paidEarly = (po: PurchaseOrder) => !!po.paymentDate && (!po.grnDate || day(po.grnDate, po.paymentDate) < 0)
export const invoiceOver = (po: PurchaseOrder) => po.invoiceAmount != null && po.invoiceAmount > po.amount

/** Same vendor, consecutive orders <= 15 days apart, each below the limit, together above it. */
// ponytail: chains consecutive gaps (a long unbroken run counts as one group); windowed clustering if that over-merges.
export function findClusters(pos: PurchaseOrder[]): Cluster[] {
  const byVendor = new Map<string, PurchaseOrder[]>()
  for (const p of pos) {
    if (p.amount >= SPLIT_LIMIT) continue
    const k = p.vendor.trim().toLowerCase()
    byVendor.set(k, [...(byVendor.get(k) ?? []), p])
  }
  const out: Cluster[] = []
  for (const list of byVendor.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let run: PurchaseOrder[] = []
    const flush = () => {
      const total = run.reduce((s, p) => s + p.amount, 0)
      if (run.length >= 2 && total >= SPLIT_LIMIT) out.push({ vendor: run[0].vendor, pos: run, total, spanDays: day(run[0].date, run[run.length - 1].date) })
      run = []
    }
    for (const p of list) {
      if (run.length && day(run[run.length - 1].date, p.date) > SPLIT_DAYS) flush()
      run.push(p)
    }
    flush()
  }
  return out.sort((a, b) => b.total - a.total)
}

export function analyse(pos: PurchaseOrder[]) {
  const clusters = findClusters(pos)
  const split = new Set(clusters.flatMap((c) => c.pos.map((p) => p.id)))
  const rows: PoRow[] = pos.map((po) => {
    const issues: IssueKey[] = []
    const overBy = Math.max(0, po.amount - po.approverLimit)
    if (overBy > 0) issues.push('above_limit')
    if (po.quotations <= 1) issues.push('one_quote')
    if (paidEarly(po)) issues.push('paid_early')
    if (invoiceOver(po)) issues.push('invoice_over')
    if (split.has(po.id)) issues.push('split')
    return { po, issues, overBy }
  })
  const total = pos.reduce((s, p) => s + p.amount, 0)
  const by = new Map<string, VendorShare>()
  for (const p of pos) {
    const v = by.get(p.vendor) ?? { vendor: p.vendor, amount: 0, pct: 0, orders: 0 }
    v.amount += p.amount
    v.orders += 1
    by.set(p.vendor, v)
  }
  const vendors = [...by.values()].map((v) => ({ ...v, pct: total ? (v.amount / total) * 100 : 0 })).sort((a, b) => b.amount - a.amount)
  const over = rows.filter((r) => r.overBy > 0).sort((a, b) => b.overBy - a.overBy)
  return { rows, clusters, vendors, total, over }
}

export const relatedFindings = (findings: Finding[], poId: string) => findings.filter((f) => f.evidence.some((e) => e.label === poId))
