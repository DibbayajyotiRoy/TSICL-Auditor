// Pure helpers for the Document Inbox: classify a file, invent plausible extracted fields,
// describe each field (label, confidence, flags). No React, no store writes.
import type { AuditDocument, DocKind } from '@/data/types'
import { TODAY } from '@/data/store'
import { formatDate, formatINR } from '@/lib/utils'

export const MAILBOX = 'demo-audit@tsicl-demo.in'
/** Demo clock: seeded documents are shown relative to this moment, not the viewer's real date. */
export const DEMO_NOW = Date.parse(`${TODAY}T10:30:00+05:30`)

export const KIND_LABEL: Record<DocKind, string> = {
  purchase_order: 'Purchase order', invoice: 'Invoice', quotation: 'Quotation', grn: 'Goods received note',
  payment_voucher: 'Payment voucher', approval_note: 'Approval note', bank_statement: 'Bank statement',
  asset_register: 'Asset register', contract: 'Contract', scrap_auction: 'Scrap auction',
}

// ---------- tiny deterministic random ----------
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function rng(seed: string) {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- classify by file name ----------
const KEYWORDS: [RegExp, DocKind][] = [
  [/purchase[-_ ]?order|work[-_ ]?order|(^|[^a-z])(po|wo)([^a-z]|$)/i, 'purchase_order'],
  [/invoice|tax[-_ ]?inv|(^|[^a-z])(inv|bill)([^a-z]|$)/i, 'invoice'],
  [/grn|goods[-_ ]?receiv|delivery[-_ ]?challan|(^|[^a-z])mrn([^a-z]|$)/i, 'grn'],
  [/quot|tender|(^|[^a-z])(qtn|bid)([^a-z]|$)/i, 'quotation'],
  [/voucher|(^|[^a-z])pv([^a-z]|$)|payment/i, 'payment_voucher'],
  [/bank|statement|passbook|(^|[^a-z])brs([^a-z]|$)/i, 'bank_statement'],
  [/asset|register|(^|[^a-z])far([^a-z]|$)/i, 'asset_register'],
  [/scrap|auction|disposal|surplus/i, 'scrap_auction'],
  [/approval|sanction|note[-_ ]?sheet/i, 'approval_note'],
  [/contract|agreement|mou/i, 'contract'],
]
/** Leftmost keyword wins ("Invoice_PO_12.pdf" is an invoice). ponytail: unknown names default to invoice with low confidence, so a human looks. */
export function classify(name: string): { kind: DocKind; sure: boolean } {
  let best: { i: number; kind: DocKind } | undefined
  for (const [re, kind] of KEYWORDS) {
    const i = name.search(re)
    if (i >= 0 && (!best || i < best.i)) best = { i, kind }
  }
  return best ? { kind: best.kind, sure: true } : { kind: 'invoice', sure: false }
}
export const isScan = (name: string, mime = '') => /^image\//.test(mime) || /\.(jpe?g|png|heic|tiff?)$/i.test(name) || /^scan/i.test(name)

// ---------- invent extracted fields ----------
const VENDORS = ['Tripura Steel Works', 'Agartala Bamboo Crafts', 'Dhalai Timber Traders', 'Sri Lakshmi Packaging', 'North East Handloom Yarns', 'Unakoti Stone Suppliers', 'Kailashahar Engineering Co.', 'Gomati Rubber Industries', 'Bodhjung Electricals', 'Khowai Agro Services']
const ITEMS = ['Loom spare parts', 'Cotton yarn, 40s count', 'Bamboo splits', 'Packaging cartons', 'Safety helmets', 'Diesel generator set', 'Rubber latex drums', 'Steel almirahs', 'Laptop computers', 'Cane furniture raw material']
const APPROVERS = ['Deputy Manager', 'Deputy Manager', 'Manager (Finance)', 'General Manager', 'Managing Director']
/** Delegated financial power per designation (₹). */
export const LIMITS: Record<string, number> = { 'Deputy Manager': 600000, 'Manager (Finance)': 1000000, 'General Manager': 2500000, 'Managing Director': 10000000 }
const pad = (n: number) => String(n).padStart(2, '0')

export function extract(kind: DocKind, seed: string, forceIssue = false): Record<string, string | number> {
  const r = rng(seed)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const n = 100 + Math.floor(r() * 800)
  const date = `2026-${pad(7 + Math.floor(r() * 3))}-${pad(1 + Math.floor(r() * 27))}`
  const vendor = pick(VENDORS)
  const item = pick(ITEMS)
  const amount = Math.round((150000 + r() * 800000) / 100) * 100
  const quantity = 5 + Math.floor(r() * 95)
  const letters = Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(r() * 26))).join('')
  const gstin = `16${letters}${1000 + Math.floor(r() * 8999)}F1Z${Math.floor(r() * 9)}`
  switch (kind) {
    case 'purchase_order': {
      const approvedBy = forceIssue ? 'Deputy Manager' : pick(APPROVERS)
      return { poNumber: `PO-2026-${n}`, vendor, item, quantity, amount: forceIssue ? Math.max(amount, 640000) : amount, date, approvedBy }
    }
    case 'invoice': return { invoiceNo: `INV/${n}/26-27`, vendor, item, amount, date, gstin }
    case 'grn': return { grnNo: `GRN-${n}`, poNumber: `PO-2026-${n - 1}`, vendor, quantity, date }
    case 'quotation': return { vendor, item, quantity, amount, validTill: `2026-${pad(10 + Math.floor(r() * 2))}-${pad(1 + Math.floor(r() * 27))}` }
    case 'payment_voucher': return { voucherNo: `PV/${n}`, vendor, amount, date, mode: pick(['NEFT', 'RTGS', 'Cheque']) }
    case 'bank_statement': return { bank: 'State Bank of India, Agartala Main', account: `XXXXXX${1000 + Math.floor(r() * 8999)}`, period: 'Jul – Sep 2026', closingBalance: amount * 12 }
    case 'asset_register': return { assetCount: 20 + Math.floor(r() * 80), totalCost: amount * 9, location: pick(['Agartala HO', 'Dharmanagar', 'Udaipur', 'Kailashahar']) }
    case 'scrap_auction': return { lotNo: `LOT-${n}`, item: 'Scrap machinery and metal', reservePrice: Math.round(amount / 2 / 100) * 100, amount, buyer: vendor, date }
    default: return { refNo: `REF-${n}`, vendor, amount, date, approvedBy: pick(APPROVERS) }
  }
}

// ---------- simulated emails ----------
export interface MailTemplate { subject: string; files: { name: string; issue?: boolean }[] }
export const MAILS: MailTemplate[] = [
  { subject: 'Q2 purchase orders – {loc} Unit', files: [{ name: 'PO_2026-{n}_{v}.pdf', issue: true }, { name: 'PO_2026-{n}_{v}.pdf' }] },
  { subject: 'Invoices for July–September – {loc}', files: [{ name: 'Invoice_{n}_{v}.pdf' }, { name: 'Scan_Invoice_{n}.jpg' }] },
  { subject: 'GRN for September deliveries – {loc}', files: [{ name: 'GRN_{n}_{v}.pdf' }] },
  { subject: 'Quotations received for {item}', files: [{ name: 'Quotation_{v}.pdf' }, { name: 'Quotation_{v}.pdf' }] },
  { subject: 'Payment vouchers, September 2026 – {loc}', files: [{ name: 'Payment_Voucher_{n}.pdf' }] },
  { subject: 'SBI Agartala bank statement – Q2 FY 2026-27', files: [{ name: 'Bank_Statement_Q2_FY27.pdf' }] },
  { subject: 'Scrap disposal: auction results – {loc}', files: [{ name: 'Scrap_Auction_Lot_{n}.pdf' }] },
  { subject: 'Asset register update – {loc}', files: [{ name: 'Asset_Register_{loc}_Q2.xlsx' }] },
]
export function fill(tpl: string, loc: string) {
  const r = Math.random
  const pickV = () => VENDORS[Math.floor(r() * VENDORS.length)].split(' ').slice(0, 2).join('_')
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k === 'n' ? String(100 + Math.floor(r() * 800)) : k === 'v' ? pickV() : k === 'loc' ? loc : k === 'item' ? ITEMS[Math.floor(r() * ITEMS.length)].toLowerCase() : ''))
}

// ---------- describing fields ----------
const LABEL: Record<string, string> = {
  vendor: 'Supplier', amount: 'Amount', poNumber: 'Purchase order no.', invoiceNo: 'Invoice no.', grnNo: 'GRN no.', voucherNo: 'Voucher no.',
  date: 'Date', item: 'Item', quantity: 'Quantity', approvedBy: 'Approved by', gstin: 'Supplier GSTIN', validTill: 'Valid till', mode: 'Paid by',
  bank: 'Bank', account: 'Account', period: 'Period', closingBalance: 'Closing balance', assetCount: 'Number of assets', totalCost: 'Total cost',
  location: 'Location', lotNo: 'Lot no.', reservePrice: 'Reserve price', buyer: 'Highest bidder', refNo: 'Reference no.',
}
export const humanize = (k: string) => LABEL[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
const isMoney = (k: string) => /amount|total|cost|price|balance|value$/i.test(k)

export function fmtField(key: string, v: string | number | undefined) {
  if (v === undefined || v === '') return ''
  if (typeof v === 'number') return isMoney(key) ? formatINR(v) : v.toLocaleString('en-IN')
  if (/date|till/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v)
  return v
}
/** What the Fix box starts with and how an edit is stored back. */
export const editText = (v: string | number) => String(v)
export const parseEdit = (old: string | number, text: string): string | number =>
  typeof old === 'number' ? Number(text.replace(/[₹,\s]/g, '')) || old : text.trim()

export interface FieldRow { key: string; label: string; text: string; raw: string | number; conf: number; flag?: 'blurry' | 'missing' }
/** Per-field confidence: close to the document's, with one weak field when a person must look. Deterministic. */
export function fieldRows(doc: AuditDocument): FieldRow[] {
  const keys = Object.keys(doc.fields)
  const flagged = doc.status === 'needs_review' && keys.length ? keys[hash(doc.id) % keys.length] : undefined
  return keys.map((key) => {
    const h = hash(doc.id + key)
    let conf = doc.confidence + ((h % 100) / 100 - 0.6) * 0.08
    if (key === flagged) conf = Math.min(conf, 0.55 + (h % 14) / 100)
    conf = Math.min(0.995, Math.max(0.3, conf))
    return { key, label: humanize(key), text: fmtField(key, doc.fields[key]), raw: doc.fields[key], conf, flag: key === flagged ? (h % 2 ? 'blurry' : 'missing') : undefined }
  })
}

// ---------- Indian number words ----------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`)
const below1000 = (n: number) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + below100(n % 100) : ''}` : below100(n))
export function inrWords(n: number) {
  n = Math.round(n)
  if (n <= 0) return 'Zero'
  const parts: string[] = []
  for (const [div, name] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']] as const) {
    const q = Math.floor(n / div)
    if (q) { parts.push(`${below100(q)} ${name}`); n %= div }
  }
  if (n) parts.push(below1000(n))
  return parts.join(' ')
}
