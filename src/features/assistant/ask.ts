// One question in, one answer out. Live Claude via the shared `ask()` when allowed (useUI.demoMode off),
// otherwise (or on any failure) the deterministic offline brain, so the demo never breaks.
import { ask, askLive } from '@/lib/ai'
import { TODAY, useAudit } from '@/data/store'
import type { Lang } from '@/lib/ui'
import { answer, chitChat, chitChatAnswer } from './offline'
import { computeFacts, findFinding, findPO, knownIds, type Data } from './facts'

export interface Msg { id: number; role: 'user' | 'assistant'; text: string; source?: 'ai' | 'offline'; fresh?: boolean }

const LANG_NAME: Record<Lang, string> = { en: 'plain, simple English', bn: 'simple Bengali (বাংলা)', hi: 'simple Hindi (हिन्दी)' }

/** Compact JSON digest of the store: counts, top findings, ageing, overdue requests, asset verification, purchases. */
function digest(d: Data, question: string) {
  const f = computeFacts(d)
  const ev = (x: { evidence: { label: string }[] }) => x.evidence.map((e) => e.label)
  const finding = (x: Data['findings'][number]) => ({ id: x.id, title: x.title, severity: x.severity, status: x.status, amountINR: x.amount, division: f.division(x.divisionId), summary: x.summary, reason: x.reason, confidence: x.confidence, evidence: ev(x) })
  const po = (p: Data['purchaseOrders'][number]) => ({ id: p.id, vendor: p.vendor, item: p.item, division: f.division(p.divisionId), date: p.date, amountINR: p.amount, approvedBy: p.approvedBy, approverLimitINR: p.approverLimit, quotations: p.quotations, invoiceAmountINR: p.invoiceAmount, grnDate: p.grnDate, paymentDate: p.paymentDate })

  const top = f.findings.slice(0, 15)
  const asked = knownIds(question, d)
  const poIds = new Set([...top.flatMap(ev), ...asked.filter((k) => k.kind === 'po').map((k) => k.id)])
  return {
    asOf: TODAY,
    period: 'Q2 FY 2026-27 (Jul-Sep 2026)',
    findings: {
      openCount: f.findings.length, bySeverity: f.bySeverity, amountAtRiskINR: f.atRisk, auditorDecisions: f.decided,
      top15: top.map((x) => ({ id: x.id, title: x.title, severity: x.severity, status: x.status, amountINR: x.amount, division: f.division(x.divisionId), reason: x.reason, evidence: ev(x) })),
    },
    receivables: {
      totalINR: f.recv.total, invoices: f.recv.count,
      ageing: f.recv.buckets.map((b) => ({ bucket: b.label, amountINR: b.amount, invoices: b.count })),
      topCustomers: f.recv.topCustomers.slice(0, 5).map((c) => ({ customer: c.customer, amountINR: c.amount, oldestInvoiceDays: c.oldest, division: c.division })),
      unmatchedBankReceipts: { count: f.recv.unmatched.length, amountINR: f.recv.unmatched.reduce((s, r) => s + r.amount, 0) },
    },
    overdueRequests: f.late.slice(0, 8).map((l) => ({ requestId: l.req.id, division: l.division, subject: l.req.subject, pendingItems: l.pending, daysPastDeadline: l.daysLate, stage: l.req.stage })),
    assets: { total: f.assets.total, verifiedPercent: f.assets.pct, found: f.assets.found, missing: f.assets.missing, damaged: f.assets.damaged, notChecked: f.assets.never },
    purchases: {
      count: f.buy.count, valueINR: f.buy.value, aboveApproverLimit: f.buy.overLimit.length, singleQuotation: f.buy.singleQuote.length,
      topVendors: f.buy.topVendors.slice(0, 5),
      flaggedOrders: [...poIds].map((id) => findPO(d, id)).filter((p) => !!p).slice(0, 12).map((p) => po(p!)),
    },
    // Full records for any finding mentioned in the latest question (it may not be in the top 15).
    askedFindings: asked.filter((k) => k.kind === 'finding').map((k) => findFinding(d, k.id)).filter((x) => !!x).slice(0, 3).map((x) => finding(x!)),
  }
}

export function buildSystem(d: Data, lang: Lang, question: string) {
  return [
    `You are "Audit Assistant" inside TSICL's AI-assisted internal-audit workspace (Tripura Small Industries Corporation Ltd). You help the Managing Director and senior officers, who are not technical.`,
    `RULES`,
    `- Answer ONLY from the DATA below. Never invent numbers, names or IDs. If the data does not contain the answer, say so.`,
    `- Reply in ${LANG_NAME[lang]}. Keep IDs, PO numbers and ₹ amounts as written. Be short: under about 120 words unless asked to draft something. Use short bullets.`,
    `- Cite finding IDs (like F-247) and PO numbers whenever you mention them.`,
    `- Write money the Indian way (₹8,42,000 or ₹4.2 Cr).`,
    `- You are AI-assisted: you flag and explain, you do not perform the audit or make decisions. The auditor (the CA firm) decides. Remind the reader of this when you suggest an action.`,
    `- Finish every answer with one last line in exactly this form: Based on: <comma-separated finding IDs, PO numbers or invoice numbers you used>`,
    `DATA (as of ${TODAY}, JSON):`,
    JSON.stringify(digest(d, question)),
  ].join('\n')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Loose prompt for casual conversation: no audit data, no citations, no invented figures. */
function generalSystem(lang: Lang) {
  return [
    `You are a friendly assistant inside TSICL's audit workspace app. This is casual conversation, not audit work.`,
    `- Be warm and brief: under about 80 words. Use simple words.`,
    `- Reply in ${LANG_NAME[lang]}.`,
    `- You have no live data feeds (no live weather, news, or prices). If asked for live information, say so honestly in one line, then give the closest useful general answer.`,
    `- Never invent audit findings, amounts, names, or IDs. If asked about TSICL audit data, say to ask with specifics, like a finding ID or "biggest risks".`,
  ].join('\n')
}
// Keep the request small: newest messages first until the budget is used, and it must start with a user turn.
function recent(history: Msg[]) {
  let budget = 6000
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of [...history].reverse().slice(0, 10)) {
    const content = m.text.slice(0, 1500)
    if ((budget -= content.length) < 0) break
    out.unshift({ role: m.role, content })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

/** `history` already ends with the new user message. `canon` is the English form of a suggested chip, used by the offline brain. */
export async function respond(question: string, canon: string | undefined, history: Msg[], lang: Lang): Promise<{ text: string; source: 'ai' | 'offline' }> {
  const d: Data = useAudit.getState()
  // Basic talk (greetings, general knowledge) is safe to generate live even in demo mode:
  // no audit numbers are involved, so nothing demo-breaking can be invented.
  const chat = chitChat(question, d)
  if (chat) {
    const live = await askLive(generalSystem(lang), recent(history))
    if (live) return { text: live, source: 'ai' }
    await sleep(400)
    return { text: chitChatAnswer(chat, d, lang), source: 'offline' }
  }
  const live = await ask(buildSystem(d, lang, question), recent(history))
  if (live) return { text: live, source: 'ai' }
  await sleep(750) // let "Reading audit data…" be seen; offline answers are otherwise instant
  return { text: answer(canon ?? question, d, lang), source: 'offline' }
}
