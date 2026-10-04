// Pure report numbers + executive-summary text. No React here.
import { AREA_LABEL, type Area, type Finding, type Severity } from '@/data/types'
import type { AuditState } from '@/data/store'
import { ask } from '@/lib/ai'
import { tr } from '@/lib/i18n'
import { formatINR, formatINRShort } from '@/lib/utils'

type Src = Pick<AuditState, 'findings' | 'documents' | 'rules' | 'purchaseOrders' | 'receivables' | 'bankReceipts' | 'assets' | 'divisions' | 'requests'>

/** UI-chrome plural: the unit word follows the report language. Summary prose keeps its own English plural below. */
export const plural = (n: number, w: string) => `${n.toLocaleString('en-IN')} ${tr(n === 1 ? w : `${w}s`)}`
const pluralEn = (n: number, w: string) => `${n.toLocaleString('en-IN')} ${w}${n === 1 ? '' : 's'}`
const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const sum = (fs: Finding[]) => fs.reduce((t, f) => t + f.amount, 0)
const bySeverityThenAmount = (a: Finding, b: Finding) => RANK[a.severity] - RANK[b.severity] || b.amount - a.amount

export interface AreaStat { area: Area; label: string; count: number; amount: number; critical: number; high: number; confirmed: number; pending: number; top?: Finding; checks: number }

/** Findings the auditor dismissed as invalid are excluded from the report's counts; they still show in section 5. */
export function buildStats(s: Src) {
  const active = s.findings.filter((f) => f.status !== 'rejected')
  const sev: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  active.forEach((f) => sev[f.severity]++)
  const sorted = [...active].sort(bySeverityThenAmount)
  const areas: AreaStat[] = (Object.keys(AREA_LABEL) as Area[]).map((area) => {
    const fs = active.filter((f) => f.area === area).sort(bySeverityThenAmount)
    return {
      area, label: AREA_LABEL[area], count: fs.length, amount: sum(fs),
      critical: fs.filter((f) => f.severity === 'critical').length, high: fs.filter((f) => f.severity === 'high').length,
      confirmed: fs.filter((f) => f.status === 'confirmed').length, pending: fs.filter((f) => f.status === 'open' || f.status === 'investigating').length,
      top: fs[0], checks: s.rules.filter((r) => r.area === area && r.enabled).length,
    }
  })
  const n = (st: Finding['status']) => s.findings.filter((f) => f.status === st).length
  const decisions = { confirmed: n('confirmed'), rejected: n('rejected'), investigating: n('investigating'), open: n('open'), pending: n('open') + n('investigating') }
  return {
    raised: s.findings.length, dismissed: decisions.rejected, reported: active.length, sev, amount: sum(active),
    areas, // every area, in AREA_LABEL order
    ranked: areas.filter((a) => a.count > 0).sort((a, b) => b.count - a.count || b.amount - a.amount),
    quiet: areas.filter((a) => a.count === 0 && a.checks > 0),
    key: sorted.filter((f) => f.severity === 'critical' || f.severity === 'high'),
    lead: sorted[0],
    decisions,
    cov: {
      documents: s.documents.length, pages: s.documents.reduce((t, d) => t + d.pages, 0), needsReview: s.documents.filter((d) => d.status === 'needs_review').length,
      checksOn: s.rules.filter((r) => r.enabled).length, checksTotal: s.rules.length, divisions: s.divisions.length,
      pos: s.purchaseOrders.length, receivables: s.receivables.length, receipts: s.bankReceipts.length, matched: s.bankReceipts.filter((r) => r.matchedReceivableId).length,
      assets: s.assets.length, verified: s.assets.filter((a) => a.verification && a.verification !== 'pending').length,
      openRequests: s.requests.filter((r) => r.stage !== 'completed').length,
      transactions: s.purchaseOrders.length + s.receivables.length + s.bankReceipts.length,
    },
  }
}
export type Stats = ReturnType<typeof buildStats>

/** Deterministic ~150-word summary, used whenever the AI is off or fails. */
export function fallbackSummary(s: Stats) {
  const c = s.cov
  const intro = `During Quarter 2 of FY 2026-27 (July–September 2026), the AI-assisted internal audit read ${pluralEn(c.documents, 'document')} from ${pluralEn(c.divisions, 'division')} and ran ${pluralEn(c.checksOn, 'audit check')} across purchases, money owed, cash, assets and compliance. `
  if (!s.reported) return intro + 'No exceptions were identified for the Board\'s attention.'
  const dismissed = s.dismissed ? `, after the auditor dismissed ${s.dismissed} as not valid` : ''
  const a = s.ranked[0]
  const t = s.key[0] ?? s.lead
  return `${intro}${pluralEn(s.reported, 'finding')} are reported${dismissed}. **${s.sev.critical} are critical** and **${s.sev.high} are high priority**, with a potential financial exposure of **${formatINRShort(s.amount)}**.

The largest concentration is in ${a.label} (${pluralEn(a.count, 'finding')}). The most significant item is ${t.id}, "${t.title}"${t.amount ? ` (${formatINR(t.amount)})` : ''}. The auditor has confirmed ${s.decisions.confirmed} and ${s.decisions.pending} await a decision. The Managing Director is requested to direct the concerned divisions to respond to the critical items before the next Board meeting.`
}

const SYSTEM = 'You draft the executive summary of a quarterly internal audit report for the Board of Tripura Small Industries Corporation Ltd (TSICL). Write about 150 words of formal, plain English in two short paragraphs. Use only the JSON facts provided: counts, amounts in INR, top areas, top items, auditor decisions. Say that findings are pending auditor review where decisions are pending. Do not invent facts. No headings, no bullet points.'

/** AI executive summary, or null (demo mode / offline / error) → caller uses fallbackSummary. */
export function askSummary(s: Stats) {
  const facts = {
    quarter: 'Q2 FY 2026-27 (July–September 2026)', documentsRead: s.cov.documents, checksRun: s.cov.checksOn, divisions: s.cov.divisions,
    findingsRaised: s.raised, dismissedByAuditor: s.dismissed, reported: s.reported, severity: s.sev, amountAtRiskINR: s.amount,
    byArea: s.ranked.map((a) => ({ area: a.label, findings: a.count, amountINR: a.amount })),
    topItems: s.key.slice(0, 5).map((f) => ({ id: f.id, area: AREA_LABEL[f.area], title: f.title, amountINR: f.amount, status: f.status })),
    auditorDecisions: s.decisions,
  }
  return ask(SYSTEM, [{ role: 'user', content: JSON.stringify(facts) }], 6000)
}
