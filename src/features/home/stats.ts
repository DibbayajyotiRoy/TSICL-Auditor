import { useMemo } from 'react'
import { useAudit } from '@/data/store'
import { AREA_LABEL, type Area, type DocRequest, type Division, type Finding, type Severity } from '@/data/types'
import { useT } from '@/lib/i18n'
import { formatINRShort } from '@/lib/utils'

export const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
export const SEV_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)', high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)',
}

export interface AreaRow { area: Area; label: string; count: number; amount: number; worst: Severity; tag: string }

/** One row of "Needs your attention": a finding, or a non-finding item that still needs a human. */
export interface AttnItem {
  key: string; severity: Severity; title: string; sub: string; amount?: number; to: string; cta: string
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const rank = (a: AttnItem, b: AttnItem) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (b.amount ?? 0) - (a.amount ?? 0)
const divName = (ds: Division[], id: string) => ds.find((d) => d.id === id)?.name ?? ''

/** Everything the Today page shows, derived once from the store. Empty arrays are fine. */
export function useHomeStats() {
  const findings = useAudit((s) => s.findings)
  const documents = useAudit((s) => s.documents)
  const requests = useAudit((s) => s.requests)
  const rules = useAudit((s) => s.rules)
  const assets = useAudit((s) => s.assets)
  const divisions = useAudit((s) => s.divisions)
  const purchaseOrders = useAudit((s) => s.purchaseOrders)
  const receivables = useAudit((s) => s.receivables)
  const bankReceipts = useAudit((s) => s.bankReceipts)
  const t = useT()

  return useMemo(() => {
    const open = findings.filter((f) => f.status === 'open')
    const urgent = open.filter((f) => f.severity === 'critical' || f.severity === 'high')
    const decided = findings.length - open.length

    // transactions the checks ran over
    const txCount = purchaseOrders.length + receivables.length + bankReceipts.length
    const txValue = sum(purchaseOrders.map((p) => p.amount)) + sum(receivables.map((r) => r.amount)) + sum(bankReceipts.map((b) => b.amount))

    const requestedItems = sum(requests.map((r) => r.items.length))
    const receivedItems = sum(requests.map((r) => r.items.filter((i) => i.received).length))
    const processed = documents.filter((d) => d.status !== 'processing').length

    const activeRules = rules.filter((r) => r.enabled).length
    const checksRun = activeRules * (documents.length + txCount + assets.length)

    // FY 2026-27 progress = documents chased in + findings the auditor has already decided on
    const progressTotal = requestedItems + findings.length
    const progress = progressTotal ? Math.round((100 * (receivedItems + decided)) / progressTotal) : 0

    const escalations: DocRequest[] = requests.filter((r) => r.stage === 'escalated' && !r.escalationApproved)
    const awaitingAssets = assets.filter((a) => (a.verification ?? 'pending') === 'pending')

    // attention list: up to 2 non-finding items (so they always show), the rest the worst findings
    const extras: AttnItem[] = [
      ...escalations.map((r): AttnItem => ({
        key: r.id, severity: 'high', title: `${t('Escalation recommended for')} ${divName(divisions, r.divisionId)}`,
        sub: `${r.subject} · ${t('awaiting your approval')}`, to: '/requests', cta: 'Review',
      })),
      ...(awaitingAssets.length ? [{
        key: 'assets', severity: 'medium' as const,
        title: `${awaitingAssets.length} ${t(awaitingAssets.length === 1 ? 'asset is awaiting verification' : 'assets are awaiting verification')}`,
        sub: `${t('Assets & Equipment')} · ${t('physical check pending')}`, amount: sum(awaitingAssets.map((a) => a.cost)), to: '/assets', cta: 'View assets',
      }] : []),
    ].slice(0, 2)
    const worst: AttnItem[] = [...open]
      .sort((a: Finding, b: Finding) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.amount - a.amount)
      .slice(0, 5 - extras.length)
      .map((f) => ({ key: f.id, severity: f.severity, title: f.title, sub: divName(divisions, f.divisionId), amount: f.amount, to: `/findings/${f.id}`, cta: 'View finding' }))
    const attention = [...worst, ...extras].sort(rank)

    const groups = new Map<Area, Finding[]>()
    for (const f of open) groups.set(f.area, [...(groups.get(f.area) ?? []), f])
    const areas: AreaRow[] = [...groups].map(([area, fs]) => {
      const amount = sum(fs.map((f) => f.amount))
      return {
        area, label: AREA_LABEL[area], count: fs.length, amount,
        worst: fs.reduce<Severity>((w, f) => (SEV_RANK[f.severity] < SEV_RANK[w] ? f.severity : w), 'low'),
        tag: `${fs.length} · ${formatINRShort(amount)}`,
      }
    }).sort((a, b) => SEV_RANK[a.worst] - SEV_RANK[b.worst] || b.amount - a.amount)

    return {
      open, urgent, decided, progress, attention, areas, activeRules, checksRun,
      urgentAmount: sum(urgent.map((f) => f.amount)),
      highPriority: urgent.length + escalations.length,
      escalations: escalations.length,
      txCount, txValue,
      docsReceived: documents.length, docsProcessed: processed,
      docsRequested: Math.max(requestedItems, documents.length),
      exceptions: findings.length,
      confirmed: findings.filter((f) => f.status === 'confirmed').length,
    }
  }, [findings, documents, requests, rules, assets, divisions, purchaseOrders, receivables, bankReceipts, t])
}
export type HomeStats = ReturnType<typeof useHomeStats>
