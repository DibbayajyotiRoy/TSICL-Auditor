import { create } from 'zustand'
import type { ActivityEvent, Asset, AuditDocument, BankReceipt, DocRequest, Division, Finding, FindingStatus, PurchaseOrder, Receivable, Rule } from './types'
import { TODAY } from './types'
import { seed } from './seed'
import { runRules } from './rules'

// Demo "today" — the whole app reasons relative to this date.
export { TODAY }
// UI concerns (sound, toasts) stay in components; this store is audit state only.

export interface AuditState {
  divisions: Division[]
  documents: AuditDocument[]
  purchaseOrders: PurchaseOrder[]
  receivables: Receivable[]
  bankReceipts: BankReceipt[]
  assets: Asset[]
  rules: Rule[]
  findings: Finding[]
  requests: DocRequest[]
  activity: ActivityEvent[]
  lastReset: string
  // actions
  decide: (findingId: string, status: FindingStatus, note?: string) => void
  addDocument: (doc: AuditDocument) => void
  updateDocument: (id: string, patch: Partial<AuditDocument>) => void
  toggleRule: (ruleId: string) => void
  rerunAudit: () => void
  advanceRequest: (requestId: string) => void
  approveEscalation: (requestId: string) => void
  markItemReceived: (requestId: string, index: number) => void
  verifyAsset: (assetId: string, result: NonNullable<Asset['verification']>) => void
  log: (kind: ActivityEvent['kind'], text: string) => void
  resetDemo: () => void
}

const STAGES: DocRequest['stage'][] = ['sent', 'reminder_1', 'reminder_2', 'escalated']
const STAGE_EVENT: Record<string, string> = {
  reminder_1: 'Reminder #1 sent (scheduled follow-up)',
  reminder_2: 'Reminder #2 sent (scheduled follow-up)',
  escalated: 'Escalation recommended — awaiting your approval',
}
let eid = 0
const now = () => new Date().toISOString()
const initial = () => { const data = seed(); return { ...data, findings: runRules(data), lastReset: now() } }

export const useAudit = create<AuditState>()((set, get) => {
  const log = (kind: ActivityEvent['kind'], text: string) =>
    set((s) => ({ activity: [{ id: `E${++eid}`, at: now(), kind, text }, ...s.activity].slice(0, 200) }))
  return {
    ...initial(),
    log,
    resetDemo: () => set(initial()),
    decide: (id, status, note) => {
      set((s) => ({ findings: s.findings.map((f) => (f.id === id ? { ...f, status, note: note ?? f.note } : f)) }))
      log('decision', `Auditor marked ${id} as ${status}`)
    },
    addDocument: (doc) => { set((s) => ({ documents: [doc, ...s.documents] })); log('doc_received', `Received ${doc.name}`) },
    updateDocument: (id, patch) => set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    toggleRule: (ruleId) => set((s) => ({ rules: s.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)) })),
    rerunAudit: () => {
      const s = get()
      const prev = new Map(s.findings.map((f) => [f.id, f]))
      // keep auditor decisions across re-runs
      const findings = runRules(s).map((f) => (prev.has(f.id) ? { ...f, status: prev.get(f.id)!.status, note: prev.get(f.id)!.note } : f))
      set({ findings })
      log('ai', `Audit checks re-run: ${findings.length} findings across ${s.rules.filter((r) => r.enabled).length} active checks`)
    },
    advanceRequest: (rid) => {
      const r = get().requests.find((x) => x.id === rid)
      if (!r || r.stage === 'completed' || r.stage === 'escalated') return
      const stage = STAGES[STAGES.indexOf(r.stage) + 1]
      set((s) => ({ requests: s.requests.map((x) => (x.id === rid ? { ...x, stage, timeline: [...x.timeline, { at: now(), event: STAGE_EVENT[stage] }] } : x)) }))
      log(stage === 'escalated' ? 'escalation' : 'reminder', `${STAGE_EVENT[stage]} — ${r.subject}`)
    },
    approveEscalation: (rid) => {
      const r = get().requests.find((x) => x.id === rid)
      if (!r || r.stage !== 'escalated' || r.escalationApproved) return
      set((s) => ({ requests: s.requests.map((x) => (x.id === rid ? { ...x, escalationApproved: true, timeline: [...x.timeline, { at: now(), event: 'Escalation approved by auditor and sent to division head' }] } : x)) }))
      log('escalation', `Escalation approved — ${r.subject}`)
    },
    markItemReceived: (rid, i) => set((s) => ({
      requests: s.requests.map((x) => {
        if (x.id !== rid) return x
        const items = x.items.map((it, j) => (j === i ? { ...it, received: true } : it))
        const done = items.every((it) => it.received)
        return { ...x, items, stage: done ? 'completed' : x.stage, timeline: done ? [...x.timeline, { at: now(), event: 'All documents received' }] : x.timeline }
      }),
    })),
    verifyAsset: (id, result) => {
      set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, verification: result, lastVerified: now() } : a)) }))
      log('decision', `Asset ${get().assets.find((a) => a.id === id)?.tag} physically verified: ${result}`)
    },
  }
})

export type SeedData = Omit<AuditState, 'findings' | 'lastReset' | 'decide' | 'addDocument' | 'updateDocument' | 'toggleRule' | 'rerunAudit' | 'advanceRequest' | 'approveEscalation' | 'markItemReceived' | 'verifyAsset' | 'log' | 'resetDemo'>
