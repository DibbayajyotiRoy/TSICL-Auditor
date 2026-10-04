// The 20 deterministic audit checks, mapped 1:1 to the EOI scope across 9 areas.
// Pure function: same seed in → same findings out. No network, no randomness.
// Keep the export signature (RULES + runRules).
import { TODAY, type Finding, type Rule } from './types.ts'
import type { SeedData } from './store'

export const ENGINE = 'Rule engine v1 (deterministic)'

/** The tender's 20 checks. `name` keeps the word "approval" on R01: the inbox flow finds it by /approval/i. */
export const RULES: Rule[] = [
  { id: 'R01', name: 'Approval above delegated power', scopeRef: 'EOI Scope: Procurement & works — delegation of financial powers', plain: 'Someone approved a purchase bigger than they are allowed to.', area: 'procurement', severity: 'critical', enabled: true },
  { id: 'R02', name: 'Only one quotation obtained', scopeRef: 'EOI Scope: Procurement & works — competitive bidding', plain: 'A purchase went ahead with just one price quote instead of comparing several.', area: 'procurement', severity: 'high', enabled: true },
  { id: 'R03', name: 'Possible split orders to stay below limits', scopeRef: 'EOI Scope: Procurement & works — splitting of orders', plain: 'Several small orders to the same supplier, close together, may be one big order split up.', area: 'procurement', severity: 'high', enabled: true },
  { id: 'R04', name: 'Invoice amount exceeds the purchase order', scopeRef: 'EOI Scope: Procurement & works — verification of supplier invoices', plain: 'The supplier billed more than the order allowed.', area: 'procurement', severity: 'medium', enabled: true },
  { id: 'R05', name: 'Paid before goods were received', scopeRef: 'EOI Scope: Procurement & works — goods receipt and payment controls', plain: 'Money went out before the goods were recorded as received.', area: 'procurement', severity: 'medium', enabled: true },
  { id: 'R06', name: 'Scrap sold below reserve price or with a single bid', scopeRef: 'EOI Scope: Scrap & surplus disposal — auction process', plain: 'Scrap was sold too cheap or with only one bidder competing.', area: 'scrap', severity: 'medium', enabled: true },
  { id: 'R07', name: 'Money owed for over 6 months', scopeRef: 'EOI Scope: Receivables & recoveries — overdue follow-up', plain: 'A customer has owed us money for more than six months.', area: 'receivables', severity: 'high', enabled: true },
  { id: 'R08', name: 'Large dues with no recent payment', scopeRef: 'EOI Scope: Receivables & recoveries — collection effort', plain: 'A large amount is stuck and nothing has come in for months.', area: 'receivables', severity: 'medium', enabled: true },
  { id: 'R09', name: 'Bank receipt not matched to any invoice', scopeRef: 'EOI Scope: Cash & bank — bank reconciliation', plain: 'Money came into the bank but we cannot tell which invoice it pays.', area: 'cash_bank', severity: 'high', enabled: true },
  { id: 'R10', name: 'Part payment received, balance still due', scopeRef: 'EOI Scope: Cash & bank — receipt accounting', plain: 'A customer paid only part of what they owe; the rest is still open.', area: 'cash_bank', severity: 'medium', enabled: true },
  { id: 'R11', name: 'Asset recorded but missing on the ground', scopeRef: 'EOI Scope: Fixed assets — physical verification', plain: 'The register says we own it, but it could not be found during verification.', area: 'fixed_assets', severity: 'high', enabled: true },
  { id: 'R12', name: 'Asset never physically verified', scopeRef: 'EOI Scope: Fixed assets — periodic verification', plain: 'An old asset has never been checked in person.', area: 'fixed_assets', severity: 'medium', enabled: true },
  { id: 'R13', name: 'Duplicate asset tag in the register', scopeRef: 'EOI Scope: Fixed assets — integrity of the asset register', plain: 'The same tag number appears twice, so no one knows which item is which.', area: 'fixed_assets', severity: 'low', enabled: true },
  { id: 'R14', name: 'Damaged asset awaiting disposal', scopeRef: 'EOI Scope: Fixed assets — condemnation and disposal', plain: 'A damaged asset is still on the books instead of being written off or auctioned.', area: 'fixed_assets', severity: 'low', enabled: true },
  { id: 'R15', name: 'Staff payment made without an approval reference', scopeRef: 'EOI Scope: Establishment — advances and staff payments', plain: 'A staff payment has no recorded approval to back it.', area: 'establishment', severity: 'medium', enabled: true },
  { id: 'R16', name: 'Blurry voucher needs a human check', scopeRef: 'EOI Scope: Establishment — scrutiny of vouchers', plain: 'A payment voucher scan is too unclear to trust without a person looking.', area: 'establishment', severity: 'low', enabled: true },
  { id: 'R17', name: 'Invoice without supplier GSTIN', scopeRef: 'EOI Scope: Statutory compliance — GST on purchases', plain: 'A supplier invoice carries no GST number, so the tax credit cannot be claimed.', area: 'compliance', severity: 'critical', enabled: true },
  { id: 'R18', name: 'Large payment without TDS reference', scopeRef: 'EOI Scope: Statutory compliance — TDS on payments', plain: 'A large payment shows no tax deducted at source.', area: 'compliance', severity: 'medium', enabled: true },
  { id: 'R19', name: 'Document needs a human check before use', scopeRef: 'EOI Scope: Internal controls — maker-checker for scanned records', plain: 'The AI could not read a document clearly; a person must confirm the details.', area: 'internal_controls', severity: 'high', enabled: true },
  { id: 'R20', name: 'High-value order with a single quote (earlier CAG concern)', scopeRef: 'EOI Scope: CAG observations — competitive bidding on large orders', plain: 'A large order went to one supplier with no competition — a pattern auditors flagged before.', area: 'cag', severity: 'medium', enabled: true },
]

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5)
const SPLIT_LIMIT = 200_000
const SPLIT_DAYS = 15

type D = Pick<SeedData, 'purchaseOrders' | 'receivables' | 'bankReceipts' | 'assets' | 'rules' | 'documents' | 'divisions'>

export function runRules(d: D): Finding[] {
  const on = new Set(d.rules.filter((r) => r.enabled).map((r) => r.id))
  const rule = (id: string) => d.rules.find((r) => r.id === id)!
  const out: Finding[] = []
  const push = (f: Omit<Finding, 'status' | 'engine' | 'scopeRef'> & { scopeRef?: string }) =>
    out.push({ ...f, status: 'open', engine: ENGINE, scopeRef: f.scopeRef ?? rule(f.ruleId).scopeRef })

  const divName = (id: string) => d.divisions.find((x) => x.id === id)?.name ?? id

  // ---- R01: approval above delegated power -------------------------------------------
  if (on.has('R01')) for (const po of d.purchaseOrders) {
    if (po.amount <= po.approverLimit) continue
    const over = po.amount - po.approverLimit
    push({
      id: `F-R01-${po.id}`, ruleId: 'R01', area: 'procurement', severity: 'critical',
      title: 'Purchase approved above allowed limit',
      summary: `${po.approvedBy} approved ${po.id} (${po.item}) beyond their delegated financial power.`,
      reason: `Approval authority exceeded by ${inr(over)}`,
      amount: po.amount, divisionId: po.divisionId,
      evidence: [{ docId: po.docIds[0], label: po.id, kind: 'purchase_order' }],
      basis: [
        { docId: po.docIds[0], doc: po.id, field: 'Approved amount', value: inr(po.amount) },
        { docId: po.docIds[0], doc: po.id, field: 'Approver and limit', value: `${po.approvedBy} — limit ${inr(po.approverLimit)}` },
      ],
      confidence: 0.96, createdAt: po.date,
    })
  }

  // ---- R02: single quotation ----------------------------------------------------------
  if (on.has('R02')) for (const po of d.purchaseOrders) {
    if (po.quotations > 1) continue
    push({
      id: `F-R02-${po.id}`, ruleId: 'R02', area: 'procurement', severity: 'high',
      title: 'Purchase with only one price quote',
      summary: `${po.id} for ${po.item} from ${po.vendor} went ahead on a single quotation.`,
      reason: `Only ${po.quotations} quotation on file for ${inr(po.amount)}`,
      amount: po.amount, divisionId: po.divisionId,
      evidence: [{ docId: po.docIds[0], label: po.id, kind: 'purchase_order' }],
      basis: [{ docId: po.docIds[0], doc: po.id, field: 'Quotations obtained', value: String(po.quotations) }],
      confidence: 0.93, createdAt: po.date,
    })
  }

  // ---- R03: split-order clusters -------------------------------------------------------
  if (on.has('R03')) {
    const byVendor = new Map<string, typeof d.purchaseOrders>()
    for (const p of d.purchaseOrders) {
      if (p.amount >= SPLIT_LIMIT) continue
      const k = p.vendor.trim().toLowerCase()
      byVendor.set(k, [...(byVendor.get(k) ?? []), p])
    }
    for (const list of byVendor.values()) {
      list.sort((a, b) => a.date.localeCompare(b.date))
      let run: typeof list = []
      const flush = () => {
        const total = run.reduce((s, p) => s + p.amount, 0)
        if (run.length >= 2 && total >= SPLIT_LIMIT) {
          const first = run[0]
          push({
            id: `F-R03-${first.id}`, ruleId: 'R03', area: 'procurement', severity: 'high',
            title: 'Small orders may be one split purchase',
            summary: `${run.length} orders to ${first.vendor} within ${days(run[0].date, run[run.length - 1].date)} days total ${inr(total)} — each below ${inr(SPLIT_LIMIT)}.`,
            reason: `${run.length} orders totalling ${inr(total)} kept under ${inr(SPLIT_LIMIT)} each`,
            amount: total, divisionId: first.divisionId,
            evidence: run.map((p) => ({ label: p.id, kind: 'purchase_order' as const })),
            basis: run.map((p) => ({ doc: p.id, field: 'Order amount / date', value: `${inr(p.amount)} on ${p.date}` })),
            confidence: 0.88, createdAt: run[run.length - 1].date,
          })
        }
        run = []
      }
      for (const p of list) {
        if (run.length && days(run[run.length - 1].date, p.date) > SPLIT_DAYS) flush()
        run.push(p)
      }
      flush()
    }
  }

  // ---- R04: invoice exceeds PO ---------------------------------------------------------
  if (on.has('R04')) for (const po of d.purchaseOrders) {
    if (po.invoiceAmount == null || po.invoiceAmount <= po.amount) continue
    push({
      id: `F-R04-${po.id}`, ruleId: 'R04', area: 'procurement', severity: 'medium',
      title: 'Supplier billed more than the order',
      summary: `${po.vendor} billed ${inr(po.invoiceAmount)} against ${po.id} for ${inr(po.amount)}.`,
      reason: `Invoice exceeds order by ${inr(po.invoiceAmount - po.amount)}`,
      amount: po.invoiceAmount - po.amount, divisionId: po.divisionId,
      evidence: [{ label: po.id, kind: 'purchase_order' }, { label: po.invoiceNo ?? 'invoice', kind: 'invoice' }],
      basis: [
        { doc: po.id, field: 'Order amount', value: inr(po.amount) },
        { doc: po.invoiceNo ?? 'invoice', field: 'Invoice amount', value: inr(po.invoiceAmount) },
      ],
      confidence: 0.94, createdAt: po.date,
    })
  }

  // ---- R05: paid before GRN --------------------------------------------------------------
  if (on.has('R05')) for (const po of d.purchaseOrders) {
    if (!po.paymentDate || (po.grnDate && po.paymentDate >= po.grnDate)) continue
    push({
      id: `F-R05-${po.id}`, ruleId: 'R05', area: 'procurement', severity: 'medium',
      title: 'Paid before goods were received',
      summary: `${po.id} (${inr(po.amount)}) was paid on ${po.paymentDate}${po.grnDate ? ` but goods arrived ${po.grnDate}` : ' with no goods receipt on file'}.`,
      reason: po.grnDate ? `Paid ${days(po.paymentDate, po.grnDate)} days before receipt` : 'Paid with no goods receipt on file',
      amount: po.amount, divisionId: po.divisionId,
      evidence: [{ label: po.id, kind: 'purchase_order' }],
      basis: [
        { doc: po.id, field: 'Payment date', value: po.paymentDate },
        { doc: po.id, field: 'Goods receipt date', value: po.grnDate ?? 'not on file' },
      ],
      confidence: 0.91, createdAt: po.paymentDate,
    })
  }

  // ---- R06: scrap below reserve / single bid ------------------------------------------------
  if (on.has('R06')) for (const doc of d.documents) {
    if (doc.kind !== 'scrap_auction' || doc.status === 'processing') continue
    const { lotNo, reservePrice, amount, bids } = doc.fields
    const rp = typeof reservePrice === 'number' ? reservePrice : undefined
    const amt = typeof amount === 'number' ? amount : undefined
    const n = typeof bids === 'number' ? bids : undefined
    if (amt == null || !((rp != null && amt < rp) || n === 1)) continue
    const why = rp != null && amt < rp ? `sold for ${inr(amt)} against a reserve of ${inr(rp)}` : 'only one bidder competed'
    push({
      id: `F-R06-${doc.id}`, ruleId: 'R06', area: 'scrap', severity: 'medium',
      title: 'Scrap lot sold too cheap or with no competition',
      summary: `Lot ${String(lotNo ?? doc.name)} was ${why}.`,
      reason: rp != null && amt < rp ? `Below reserve by ${inr(rp - amt)}` : 'Single bid received',
      amount: rp != null && amt < rp ? rp - amt : amt, divisionId: doc.divisionId,
      evidence: [{ docId: doc.id, label: String(lotNo ?? doc.id), kind: 'scrap_auction' }],
      basis: [
        { docId: doc.id, doc: String(lotNo ?? doc.name), field: 'Reserve price', value: rp != null ? inr(rp) : 'not on file' },
        { docId: doc.id, doc: String(lotNo ?? doc.name), field: 'Sale amount / bids', value: `${inr(amt)} · ${n ?? '?'} bids` },
      ],
      confidence: 0.9, createdAt: String(doc.fields.date ?? doc.receivedAt).slice(0, 10),
    })
  }

  // ---- R07: overdue > 180 days ---------------------------------------------------------------
  if (on.has('R07')) for (const r of d.receivables) {
    const clock = r.lastPaymentDate && r.lastPaymentDate >= r.invoiceDate ? r.lastPaymentDate : r.invoiceDate
    const age = days(clock, TODAY)
    if (age <= 180 || r.amount < 50000) continue
    push({
      id: `F-R07-${r.id}`, ruleId: 'R07', area: 'receivables', severity: 'high',
      title: 'Customer owes us money for over 6 months',
      summary: `${r.customer} owes ${inr(r.amount)} since ${r.invoiceDate} — about ${Math.round(age / 30.4)} months.`,
      reason: `${inr(r.amount)} outstanding for ${age} days`,
      amount: r.amount, divisionId: r.divisionId,
      evidence: [{ label: r.invoiceNo, kind: 'ledger' }],
      basis: [
        { doc: r.invoiceNo, field: 'Invoice date / amount', value: `${r.invoiceDate} · ${inr(r.amount)}` },
        { doc: r.invoiceNo, field: 'Last payment', value: r.lastPaymentDate ?? 'none received' },
      ],
      confidence: 0.95, createdAt: r.invoiceDate,
    })
  }

  // ---- R08: large dues, nothing recent ----------------------------------------------------------------
  if (on.has('R08')) for (const r of d.receivables) {
    const clock = r.lastPaymentDate && r.lastPaymentDate >= r.invoiceDate ? r.lastPaymentDate : r.invoiceDate
    const age = days(clock, TODAY)
    if (age <= 90 || r.amount < 100000) continue
    if (on.has('R07') && age > 180 && r.amount >= 50000) continue // already covered by R07
    push({
      id: `F-R08-${r.id}`, ruleId: 'R08', area: 'receivables', severity: 'medium',
      title: 'Large dues with no recent payment',
      summary: `${inr(r.amount)} from ${r.customer} has seen ${r.lastPaymentDate ? `no payment since ${r.lastPaymentDate}` : 'no payment at all'} (${age} days).`,
      reason: `${inr(r.amount)} stuck for ${age} days`,
      amount: r.amount, divisionId: r.divisionId,
      evidence: [{ label: r.invoiceNo, kind: 'ledger' }],
      basis: [{ doc: r.invoiceNo, field: 'Outstanding / last movement', value: `${inr(r.amount)} · ${r.lastPaymentDate ?? r.invoiceDate}` }],
      confidence: 0.9, createdAt: r.invoiceDate,
    })
  }

  // ---- R09: unmatched bank receipts --------------------------------------------------------------------
  if (on.has('R09')) for (const b of d.bankReceipts) {
    if (b.matchedReceivableId || b.amount < 25000 || days(b.date, TODAY) < 7) continue
    push({
      id: `F-R09-${b.id}`, ruleId: 'R09', area: 'cash_bank', severity: 'high',
      title: 'Bank receipt we cannot match to an invoice',
      summary: `${inr(b.amount)} arrived on ${b.date} but matches no invoice: “${b.narration}”.`,
      reason: `${inr(b.amount)} unreconciled since ${b.date}`,
      amount: b.amount, divisionId: d.divisions[0]?.id ?? 'D1',
      evidence: [{ label: b.id, kind: 'bank' }],
      basis: [
        { doc: b.id, field: 'Receipt amount / date', value: `${inr(b.amount)} on ${b.date}` },
        { doc: b.id, field: 'Bank narration', value: b.narration },
      ],
      confidence: 0.89, createdAt: b.date,
    })
  }

  // ---- R10: part payments -----------------------------------------------------------------------
  if (on.has('R10')) for (const b of d.bankReceipts) {
    if (!b.matchedReceivableId) continue
    const rec = d.receivables.find((r) => r.id === b.matchedReceivableId)
    if (!rec || rec.amount === b.amount) continue
    const balance = rec.amount - b.amount
    push({
      id: `F-R10-${b.id}`, ruleId: 'R10', area: 'cash_bank', severity: 'medium',
      title: 'Only part of the invoice has been paid',
      summary: `${inr(b.amount)} came in against ${rec.invoiceNo} (${inr(rec.amount)}) — ${inr(Math.abs(balance))} ${balance > 0 ? 'still due' : 'overpaid'}.`,
      reason: balance > 0 ? `${inr(balance)} still due on ${rec.invoiceNo}` : `${inr(-balance)} overpaid on ${rec.invoiceNo}`,
      amount: Math.abs(balance), divisionId: rec.divisionId,
      evidence: [{ label: rec.invoiceNo, kind: 'ledger' }, { label: b.id, kind: 'bank' }],
      basis: [
        { doc: rec.invoiceNo, field: 'Invoice amount', value: inr(rec.amount) },
        { doc: b.id, field: 'Receipt amount', value: inr(b.amount) },
      ],
      confidence: 0.92, createdAt: b.date,
    })
  }

  // ---- R11: missing assets -------------------------------------------------------------------
  if (on.has('R11')) for (const a of d.assets) {
    if (a.verification !== 'missing') continue
    push({
      id: `F-R11-${a.id}`, ruleId: 'R11', area: 'fixed_assets', severity: 'high',
      title: 'Asset on the books but missing on the ground',
      summary: `${a.name} (${a.tag}, ${inr(a.cost)}) at ${a.location} could not be found during verification.`,
      reason: `${a.tag} missing — ${inr(a.cost)} at risk`,
      amount: a.cost, divisionId: d.divisions.find((x) => x.location === a.location)?.id ?? d.divisions[0]?.id ?? 'D1',
      evidence: [{ label: a.tag, kind: 'register' }],
      basis: [
        { doc: a.tag, field: 'Register entry', value: `${a.name} · ${inr(a.cost)} · ${a.location}` },
        { doc: a.tag, field: 'Verification result', value: `missing${a.lastVerified ? ` (last seen ${a.lastVerified.slice(0, 10)})` : ''}` },
      ],
      confidence: 0.93, createdAt: (a.lastVerified ?? a.purchaseDate).slice(0, 10),
    })
  }

  // ---- R12: never verified ----------------------------------------------------------------------
  if (on.has('R12')) for (const a of d.assets) {
    if (a.lastVerified || a.verification === 'missing' || days(a.purchaseDate, TODAY) < 365) continue
    push({
      id: `F-R12-${a.id}`, ruleId: 'R12', area: 'fixed_assets', severity: 'medium',
      title: 'Old asset never checked in person',
      summary: `${a.name} (${a.tag}, bought ${a.purchaseDate}) has never been physically verified.`,
      reason: `No physical check in ${Math.floor(days(a.purchaseDate, TODAY) / 365)}+ years`,
      amount: a.cost, divisionId: d.divisions.find((x) => x.location === a.location)?.id ?? d.divisions[0]?.id ?? 'D1',
      evidence: [{ label: a.tag, kind: 'register' }],
      basis: [{ doc: a.tag, field: 'Purchase date / last check', value: `${a.purchaseDate} · never` }],
      confidence: 0.9, createdAt: TODAY,
    })
  }

  // ---- R13: duplicate tags -----------------------------------------------------------------
  if (on.has('R13')) {
    const seen = new Map<string, typeof d.assets>()
    for (const a of d.assets) seen.set(a.tag, [...(seen.get(a.tag) ?? []), a])
    for (const [tag, list] of seen) {
      if (list.length < 2) continue
      push({
        id: `F-R13-${list[0].id}`, ruleId: 'R13', area: 'fixed_assets', severity: 'low',
        title: 'Same asset tag used twice',
        summary: `Tag ${tag} appears ${list.length} times in the register (${list.map((a) => a.name).join(' / ')}).`,
        reason: `Tag ${tag} duplicated ${list.length}×`,
        amount: list.reduce((s, a) => s + a.cost, 0), divisionId: d.divisions.find((x) => x.location === list[0].location)?.id ?? d.divisions[0]?.id ?? 'D1',
        evidence: list.map((a) => ({ label: a.tag, kind: 'register' as const })),
        basis: list.map((a) => ({ doc: tag, field: 'Register row', value: `${a.id} · ${a.name} · ${a.location}` })),
        confidence: 0.97, createdAt: TODAY,
      })
    }
  }

  // ---- R14: damaged assets ----------------------------------------------------------------
  if (on.has('R14')) for (const a of d.assets) {
    if (a.verification !== 'damaged') continue
    push({
      id: `F-R14-${a.id}`, ruleId: 'R14', area: 'fixed_assets', severity: 'low',
      title: 'Damaged asset still on the books',
      summary: `${a.name} (${a.tag}, ${inr(a.cost)}) at ${a.location} is damaged but not written off or auctioned.`,
      reason: `Damaged item worth ${inr(a.cost)} still carried`,
      amount: a.cost, divisionId: d.divisions.find((x) => x.location === a.location)?.id ?? d.divisions[0]?.id ?? 'D1',
      evidence: [{ label: a.tag, kind: 'register' }],
      basis: [{ doc: a.tag, field: 'Condition', value: `damaged (seen ${a.lastVerified?.slice(0, 10) ?? 'date unknown'})` }],
      confidence: 0.91, createdAt: (a.lastVerified ?? TODAY).slice(0, 10),
    })
  }

  // ---- R15: staff payment without approval --------------------------------------------------
  if (on.has('R15')) for (const doc of d.documents) {
    if (doc.kind !== 'payment_voucher' || doc.status !== 'extracted') continue
    const amt = doc.fields.amount
    if (typeof amt !== 'number' || amt < 50000 || doc.fields.approvedBy) continue
    push({
      id: `F-R15-${doc.id}`, ruleId: 'R15', area: 'establishment', severity: 'medium',
      title: 'Staff payment without an approval on file',
      summary: `Voucher ${String(doc.fields.voucherNo ?? doc.name)} for ${inr(amt)} carries no recorded approval.`,
      reason: `${inr(amt)} paid with no approval reference`,
      amount: amt, divisionId: doc.divisionId,
      evidence: [{ docId: doc.id, label: String(doc.fields.voucherNo ?? doc.id), kind: 'payment_voucher' }],
      basis: [
        { docId: doc.id, doc: String(doc.fields.voucherNo ?? doc.name), field: 'Amount', value: inr(amt) },
        { docId: doc.id, doc: String(doc.fields.voucherNo ?? doc.name), field: 'Approved by', value: 'not on file' },
      ],
      confidence: 0.89, createdAt: String(doc.fields.date ?? doc.receivedAt).slice(0, 10),
    })
  }

  // ---- R16: blurry voucher -----------------------------------------------------------------
  if (on.has('R16')) for (const doc of d.documents) {
    if (doc.kind !== 'payment_voucher' || doc.status !== 'needs_review') continue
    const amt = typeof doc.fields.amount === 'number' ? doc.fields.amount : 0
    push({
      id: `F-R16-${doc.id}`, ruleId: 'R16', area: 'establishment', severity: 'low',
      title: 'Voucher scan too unclear to trust',
      summary: `${doc.name} could only be read with ${Math.round(doc.confidence * 100)}% confidence — the amounts need a human eye.`,
      reason: `Read at ${Math.round(doc.confidence * 100)}% confidence`,
      amount: amt, divisionId: doc.divisionId,
      evidence: [{ docId: doc.id, label: doc.name, kind: 'payment_voucher' }],
      basis: [{ docId: doc.id, doc: doc.name, field: 'Reading confidence', value: `${Math.round(doc.confidence * 100)}%` }],
      confidence: 0.85, createdAt: doc.receivedAt.slice(0, 10),
    })
  }

  // ---- R17: invoice without GSTIN ----------------------------------------------------------
  if (on.has('R17')) for (const doc of d.documents) {
    if (doc.kind !== 'invoice' || doc.status !== 'extracted') continue
    const gst = doc.fields.gstin
    if (typeof gst === 'string' && gst.trim()) continue
    const amt = typeof doc.fields.amount === 'number' ? doc.fields.amount : 0
    push({
      id: `F-R17-${doc.id}`, ruleId: 'R17', area: 'compliance', severity: 'critical',
      title: 'Supplier invoice has no GST number',
      summary: `Invoice ${String(doc.fields.invoiceNo ?? doc.name)} from ${String(doc.fields.vendor ?? 'a supplier')} carries no GSTIN — input tax credit of up to ${inr(amt * 0.18)} cannot be claimed.`,
      reason: `GSTIN missing on ${inr(amt)} invoice`,
      amount: amt, divisionId: doc.divisionId,
      evidence: [{ docId: doc.id, label: String(doc.fields.invoiceNo ?? doc.id), kind: 'invoice' }],
      basis: [
        { docId: doc.id, doc: String(doc.fields.invoiceNo ?? doc.name), field: 'Supplier GSTIN', value: 'not on the invoice' },
        { docId: doc.id, doc: String(doc.fields.invoiceNo ?? doc.name), field: 'Invoice amount', value: inr(amt) },
      ],
      confidence: 0.92, createdAt: String(doc.fields.date ?? doc.receivedAt).slice(0, 10),
    })
  }

  // ---- R18: large payment without TDS ------------------------------------------------------
  if (on.has('R18')) for (const doc of d.documents) {
    if (doc.kind !== 'payment_voucher' || doc.status !== 'extracted') continue
    const amt = doc.fields.amount
    if (typeof amt !== 'number' || amt < 200000 || doc.fields.tds) continue
    push({
      id: `F-R18-${doc.id}`, ruleId: 'R18', area: 'compliance', severity: 'medium',
      title: 'Large payment shows no tax deducted',
      summary: `Voucher ${String(doc.fields.voucherNo ?? doc.name)} for ${inr(amt)} shows no TDS challan reference.`,
      reason: `No TDS reference on ${inr(amt)} payment`,
      amount: Math.round(amt * 0.1), divisionId: doc.divisionId,
      evidence: [{ docId: doc.id, label: String(doc.fields.voucherNo ?? doc.id), kind: 'payment_voucher' }],
      basis: [
        { docId: doc.id, doc: String(doc.fields.voucherNo ?? doc.name), field: 'Payment amount', value: inr(amt) },
        { docId: doc.id, doc: String(doc.fields.voucherNo ?? doc.name), field: 'TDS challan', value: 'not on file' },
      ],
      confidence: 0.88, createdAt: String(doc.fields.date ?? doc.receivedAt).slice(0, 10),
    })
  }

  // ---- R19: documents needing a human check ------------------------------------------------
  if (on.has('R19')) for (const doc of d.documents) {
    if (doc.status !== 'needs_review') continue
    const amt = typeof doc.fields.amount === 'number' ? doc.fields.amount : 0
    push({
      id: `F-R19-${doc.id}`, ruleId: 'R19', area: 'internal_controls', severity: 'high',
      title: 'Document needs a human check before use',
      summary: `${doc.name} was read at ${Math.round(doc.confidence * 100)}% confidence. Nothing from it should enter the audit until a person confirms the details.`,
      reason: `Read at ${Math.round(doc.confidence * 100)}% confidence — held for review`,
      amount: amt, divisionId: doc.divisionId,
      evidence: [{ docId: doc.id, label: doc.name, kind: doc.kind }],
      basis: [{ docId: doc.id, doc: doc.name, field: 'Reading confidence', value: `${Math.round(doc.confidence * 100)}% (needs 80%+)` }],
      confidence: 0.9, createdAt: doc.receivedAt.slice(0, 10),
    })
  }

  // ---- R20: high-value single-quote order (repeat CAG concern) ------------------------------
  if (on.has('R20')) for (const po of d.purchaseOrders) {
    if (po.quotations > 1 || po.amount < 1000000) continue
    push({
      id: `F-R20-${po.id}`, ruleId: 'R20', area: 'cag', severity: 'medium',
      title: 'Large single-quote order, flagged before',
      summary: `${po.id} (${po.item}, ${inr(po.amount)}) went to ${po.vendor} on one quotation — the same pattern as CAG para 4.2 of FY 2023-24. The division is ${divName(po.divisionId)}.`,
      reason: `${inr(po.amount)} order on a single quotation`,
      amount: po.amount, divisionId: po.divisionId,
      evidence: [{ docId: po.docIds[0], label: po.id, kind: 'purchase_order' }],
      basis: [
        { docId: po.docIds[0], doc: po.id, field: 'Order value / quotations', value: `${inr(po.amount)} · ${po.quotations} quote` },
        { doc: 'CAG Report FY 2023-24', field: 'Earlier para', value: 'Para 4.2 — competitive bidding on large orders' },
      ],
      confidence: 0.87, createdAt: po.date,
    })
  }

  return out.sort((a, b) => a.id.localeCompare(b.id))
}
