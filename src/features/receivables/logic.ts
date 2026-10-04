// Pure helpers for the Money Owed page: ageing, receipt matching, plain-language text.
import type { BankReceipt, EvidenceRef, Receivable, Severity } from '../../data/types.ts'
import { daysBetween } from '../../lib/utils.ts'
import { tr } from '../../lib/i18n.ts'

export const BUCKETS = [
  { label: '0–30 days', sev: 'low', bar: 'bg-sev-low' },
  { label: '31–90 days', sev: 'medium', bar: 'bg-sev-medium' },
  { label: '91–180 days', sev: 'high', bar: 'bg-sev-high' },
  { label: 'Over 180 days', sev: 'critical', bar: 'bg-sev-critical' },
] as const satisfies readonly { label: string; sev: Severity; bar: string }[]

/** Clock starts at the later of invoice date and last payment. */
export function ageInfo(r: Receivable, today: string) {
  const paid = !!r.lastPaymentDate && r.lastPaymentDate >= r.invoiceDate
  const days = Math.max(0, daysBetween(paid ? r.lastPaymentDate! : r.invoiceDate, today))
  const bucket = days <= 30 ? 0 : days <= 90 ? 1 : days <= 180 ? 2 : 3
  return { days, bucket, paid }
}

/** "287 days since last payment" */
export function sinceText({ days, paid }: ReturnType<typeof ageInfo>) {
  const unit = tr(days === 1 ? 'day' : 'days')
  return paid ? `${days} ${unit} ${tr('since last payment')}` : `${days} ${unit} ${tr('since invoice, nothing paid')}`
}

export const monthsText = (days: number) => (days >= 90 ? `${tr('about')} ${Math.round(days / 30.4)} ${tr('months')}` : '')

export const inL = (n: number) => (n === 0 ? '₹0' : `₹${(n / 1e5).toFixed(1)} L`)

export function ageing(recs: Receivable[], today: string) {
  const out = BUCKETS.map(() => ({ amount: 0, count: 0 }))
  for (const r of recs) {
    const b = out[ageInfo(r, today).bucket]
    b.amount += r.amount
    b.count++
  }
  return out
}

const GOVT = /\b(dept|department|directorate|govt|government|board|ministry|office|commission|council|municipal|corporation)\b/i

/** Who holds the old money: top-3 customers among invoices older than 6 months. */
export function oldMoney(recs: Receivable[], today: string) {
  const by = new Map<string, number>()
  let total = 0
  for (const r of recs) {
    if (ageInfo(r, today).bucket !== 3) continue
    total += r.amount
    by.set(r.customer, (by.get(r.customer) ?? 0) + r.amount)
  }
  const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount }))
  const share = total ? top.reduce((s, t) => s + t.amount, 0) / total : 0
  return { total, top, share, govt: top.length > 0 && top.every((t) => GOVT.test(t.name)) }
}

// ---- receipt matching -------------------------------------------------------------------------
// ponytail: word/amount heuristic, fine for a few hundred receipts. Swap for a real model if volume grows.
const STOP = new Set(['the', 'and', 'ltd', 'limited', 'pvt', 'private', 'dept', 'department', 'govt', 'government', 'office', 'company', 'tripura', 'agartala'])
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface Suggestion {
  receivable: Receivable
  score: number
  reasons: string[]
  evidence: EvidenceRef
}

export function suggestMatch(rc: BankReceipt, recs: Receivable[], skip: string[] = []): Suggestion | null {
  const narr = rc.narration.toLowerCase()
  const narrAlnum = alnum(rc.narration)
  let best: Suggestion | null = null
  for (const r of recs) {
    if (r.amount <= 0 || skip.includes(r.id)) continue
    const hi = Math.max(r.amount, rc.amount)
    const closeness = hi ? Math.min(r.amount, rc.amount) / hi : 0
    const tokens = r.customer.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t))
    const hits = tokens.filter((t) => narr.includes(t) || (t.length >= 5 && narr.includes(t.slice(0, 4))))
    const tail = r.invoiceNo.match(/\d{3,}$/)?.[0]
    const invHit = narrAlnum.includes(alnum(r.invoiceNo)) || (!!tail && new RegExp(`(?<![0-9])${tail}(?![0-9])`).test(narr))
    // only an exact amount counts for much; a near amount alone must not beat a name in the bank note
    const amountPts = hi - Math.min(r.amount, rc.amount) === 0 ? 0.5 : 0.25 * closeness ** 2
    const score = Math.min(0.98, amountPts + 0.45 * (tokens.length ? hits.length / tokens.length : 0) + (invHit ? 0.3 : 0))
    if (score < 0.35 || (best && best.score >= score)) continue
    const reasons: string[] = []
    const diff = Math.abs(r.amount - rc.amount)
    const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
    reasons.push(diff === 0 ? tr('Amount matches the invoice exactly') : rc.amount < r.amount ? `${money(diff)} ${tr('less than the invoice, may be a part payment')}` : `${money(diff)} ${tr('more than the invoice')}`)
    if (hits.length) reasons.push(`${tr('Bank note mentions')} “${hits.join(' ')}”`)
    if (invHit) reasons.push(`${tr('Bank note carries invoice number')} ${r.invoiceNo}`)
    best = { receivable: r, score, reasons, evidence: { label: r.invoiceNo, kind: 'ledger' } }
  }
  return best
}
