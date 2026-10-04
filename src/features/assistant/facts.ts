// Pure numbers derived from the audit store. Shared by the offline brain and the AI digest,
// so the model and the offline answers can never disagree on a figure.
import type { AuditState } from '@/data/store'
import { TODAY } from '@/data/store'
import type { DocRequest, Finding, PurchaseOrder, Severity } from '@/data/types'
import { daysBetween } from '@/lib/utils'

export type Data = Pick<AuditState, 'divisions' | 'documents' | 'purchaseOrders' | 'receivables' | 'bankReceipts' | 'assets' | 'findings' | 'requests'>

export const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
export const SEV_WORD: Record<Severity, string> = { critical: 'Urgent', high: 'Important', medium: 'Check soon', low: 'Minor' }

const BUCKETS = [['0–30 days', 30], ['31–60 days', 60], ['61–90 days', 90], ['Over 90 days', Infinity]] as const

export interface LateRequest { req: DocRequest; division: string; pending: string[]; daysLate: number }

export function computeFacts(d: Data) {
  const division = (id: string) => d.divisions.find((x) => x.id === id)?.name ?? id

  // Findings still in play (not rejected by the auditor), worst first.
  const findings = d.findings
    .filter((f) => f.status !== 'rejected')
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.amount - a.amount)
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>
  for (const f of findings) bySeverity[f.severity]++
  const atRisk = findings.reduce((s, f) => s + f.amount, 0)
  const decided = {
    confirmed: d.findings.filter((f) => f.status === 'confirmed').length,
    rejected: d.findings.filter((f) => f.status === 'rejected').length,
    open: d.findings.filter((f) => f.status === 'open' || f.status === 'investigating').length,
  }

  // Money owed to us, by invoice age.
  const recvTotal = d.receivables.reduce((s, r) => s + r.amount, 0)
  const buckets = BUCKETS.map(([label]) => ({ label, amount: 0, count: 0 }))
  const byCustomer = new Map<string, { customer: string; amount: number; oldest: number; division: string }>()
  for (const r of d.receivables) {
    const age = daysBetween(r.invoiceDate, TODAY)
    const b = buckets[BUCKETS.findIndex(([, max]) => age <= max)]
    b.amount += r.amount
    b.count++
    const c = byCustomer.get(r.customer) ?? { customer: r.customer, amount: 0, oldest: 0, division: division(r.divisionId) }
    c.amount += r.amount
    c.oldest = Math.max(c.oldest, age)
    byCustomer.set(r.customer, c)
  }
  const over90 = buckets[3].amount
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.amount - a.amount)
  const unmatched = d.bankReceipts.filter((r) => !r.matchedReceivableId)

  // Departments behind with documents.
  const late: LateRequest[] = d.requests
    .filter((r) => r.stage !== 'completed')
    .map((req) => ({ req, division: division(req.divisionId), pending: req.items.filter((i) => !i.received).map((i) => i.label), daysLate: daysBetween(req.deadline, TODAY) }))
    .filter((l) => l.pending.length > 0 && (l.daysLate > 0 || l.req.stage !== 'sent'))
    .sort((a, b) => b.daysLate - a.daysLate)

  // Physical verification of assets.
  const checked = d.assets.filter((a) => a.lastVerified || (a.verification && a.verification !== 'pending'))
  const count = (v: string) => d.assets.filter((a) => a.verification === v).length
  const assets = {
    total: d.assets.length,
    checked: checked.length,
    pct: d.assets.length ? Math.round((checked.length / d.assets.length) * 100) : 0,
    found: count('found'), missing: count('missing'), damaged: count('damaged'),
    never: d.assets.length - checked.length,
    cost: d.assets.reduce((s, a) => s + a.cost, 0),
    unverifiedTop: d.assets.filter((a) => !checked.includes(a)).sort((a, b) => b.cost - a.cost),
  }

  // Purchases.
  const overLimit = d.purchaseOrders.filter((p) => p.amount > p.approverLimit).sort((a, b) => b.amount - b.approverLimit - (a.amount - a.approverLimit))
  const singleQuote = d.purchaseOrders.filter((p) => p.quotations <= 1)
  const poValue = d.purchaseOrders.reduce((s, p) => s + p.amount, 0)
  const vendors = new Map<string, number>()
  for (const p of d.purchaseOrders) vendors.set(p.vendor, (vendors.get(p.vendor) ?? 0) + p.amount)
  const topVendors = [...vendors].map(([vendor, value]) => ({ vendor, value, share: poValue ? Math.round((value / poValue) * 100) : 0 })).sort((a, b) => b.value - a.value)

  return { division, findings, bySeverity, atRisk, decided, recv: { total: recvTotal, count: d.receivables.length, buckets, over90, topCustomers, unmatched }, late, assets, buy: { count: d.purchaseOrders.length, value: poValue, overLimit, singleQuote, topVendors } }
}
export type Facts = ReturnType<typeof computeFacts>

export const findFinding = (d: Data, id: string): Finding | undefined => d.findings.find((f) => f.id.toLowerCase() === id.toLowerCase())
export const findPO = (d: Data, id: string): PurchaseOrder | undefined => d.purchaseOrders.find((p) => p.id.toLowerCase() === id.toLowerCase())

// IDs are matched against what is really in the store (finding ids may look like "F-247" or "F-R01-PO-2026-184"),
// longest first so "PO-2026-184" inside "F-R01-PO-2026-184" is not double counted.
const known = (d: Data) => [...d.findings.map((f) => ({ id: f.id, kind: 'finding' as const })), ...d.purchaseOrders.map((p) => ({ id: p.id, kind: 'po' as const }))].sort((a, b) => b.id.length - a.id.length)
const word = /[A-Za-z0-9]/

/** Known finding / PO ids mentioned in `text`, in order of first mention. */
export function knownIds(text: string, d: Data): { id: string; kind: 'finding' | 'po' }[] {
  let work = text.toLowerCase()
  const hits: { id: string; kind: 'finding' | 'po'; at: number }[] = []
  for (const k of known(d)) {
    const needle = k.id.toLowerCase()
    for (let from = 0; ; ) {
      const at = work.indexOf(needle, from)
      if (at < 0) break
      from = at + needle.length
      if (word.test(work[at - 1] ?? ' ') || word.test(work[from] ?? ' ')) continue
      hits.push({ ...k, at })
      work = work.slice(0, at) + ' '.repeat(needle.length) + work.slice(from)
    }
  }
  return hits.sort((a, b) => a.at - b.at)
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Turn known F-/PO- ids into markdown links the UI renders as clickable chips. Unknown ids are left as plain text. */
export function linkIds(text: string, d: Data): string {
  const all = known(d)
  if (!all.length) return text
  const re = new RegExp(`(?<![\\w[/\`-])(${all.map((k) => esc(k.id)).join('|')})(?![\\w\\]\`-])`, 'gi')
  return text.replace(re, (m) => {
    const hit = all.find((k) => k.id.toLowerCase() === m.toLowerCase())!
    return hit.kind === 'finding' ? `[${hit.id}](/findings/${hit.id})` : `[${hit.id}](/procurement)`
  })
}
