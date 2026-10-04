// The live "reading" pipeline. Lives outside React so a document keeps moving even if you leave the page.
// Documents are real store rows (addDocument -> updateDocument); only the in-flight stage and the
// human's per-field decisions are kept here, because the shared AuditDocument type has no stage field.
import { create } from 'zustand'
import { useAudit } from '@/data/store'
import type { AuditDocument, Division, Finding } from '@/data/types'
import { play } from '@/lib/sound'
import { formatINR } from '@/lib/utils'
import { KIND_LABEL, LIMITS, MAILS, classify, extract, fill, hash, isScan, rng } from './model'

/** Received -> Reading -> Sorted -> Extracted -> Checked */
export const STAGES = ['Received', 'Reading', 'Sorted', 'Extracted', 'Checked'] as const

interface FlowState {
  /** in-flight documents only: 0..4 (4 = running checks). Removed when finished. */
  stage: Record<string, number>
  /** documents that arrived in this session, newest first (they float to the top) */
  session: string[]
  subject: Record<string, string>
  /** human check per extracted field: `${docId}:${key}` */
  verdict: Record<string, 'ok' | 'fixed'>
}
export const useFlow = create<FlowState>()(() => ({ stage: {}, session: [], subject: {}, verdict: {} }))

/** Where a document sits in the pipeline right now. Finished ones: needs-review stops at Extracted, the rest reach Checked. */
export function stageOf(d: AuditDocument, flight: Record<string, number>) {
  return flight[d.id] ?? (d.status === 'processing' ? 1 : d.status === 'needs_review' ? 3 : 4)
}

export interface Incoming { name: string; mime?: string; source: 'email' | 'upload'; from?: string; subject?: string; division: Division; issue?: boolean }

const setStage = (id: string, n: number) => useFlow.setState((s) => ({ stage: { ...s.stage, [id]: n } }))
function nextNo(prefix: string, ids: string[]) {
  const max = ids.reduce((m, id) => Math.max(m, parseInt(id.replace(/\D/g, ''), 10) || 0), 0)
  return `${prefix}${String(max + 1).padStart(prefix === 'F-' ? 3 : 4, '0')}`
}

/** One document through ~4 seconds of reading. */
function run(inc: Incoming) {
  const audit = useAudit.getState()
  const id = nextNo('DOC-', audit.documents.map((d) => d.id))
  const { kind, sure } = classify(inc.name)
  const r = rng(id + inc.name)
  let confidence = sure ? 0.9 + r() * 0.08 : 0.6 + r() * 0.12
  if (isScan(inc.name, inc.mime)) confidence = Math.min(confidence, 0.6 + r() * 0.12) // blurry scan
  audit.addDocument({
    id, name: inc.name, kind, divisionId: inc.division.id, receivedAt: new Date().toISOString(), source: inc.source,
    from: inc.source === 'email' ? inc.from ?? inc.division.email : undefined, status: 'processing', confidence: 0, fields: {}, pages: 1 + Math.floor(r() * 4),
  })
  useFlow.setState((s) => ({ stage: { ...s.stage, [id]: 0 }, session: [id, ...s.session], subject: inc.subject ? { ...s.subject, [id]: inc.subject } : s.subject }))
  setTimeout(() => setStage(id, 1), 650)
  setTimeout(() => setStage(id, 2), 1700)
  setTimeout(() => { useAudit.getState().updateDocument(id, { fields: extract(kind, id + inc.name, inc.issue) }); setStage(id, 3) }, 2600)
  setTimeout(() => setStage(id, 4), 3300)
  setTimeout(() => finish(id, confidence), 4000)
}

function finish(id: string, confidence: number) {
  const a = useAudit.getState()
  const status = confidence < 0.8 ? 'needs_review' : 'extracted'
  a.updateDocument(id, { status, confidence })
  useFlow.setState((s) => { const { [id]: _done, ...rest } = s.stage; return { stage: rest } })
  const doc = useAudit.getState().documents.find((d) => d.id === id)
  if (!doc) return
  a.log('ai', `AI-assisted reading finished: ${doc.name} (${KIND_LABEL[doc.kind]}, ${Object.keys(doc.fields).length} details)${status === 'needs_review' ? ' — needs a human look' : ''}`)
  if (status === 'extracted') raiseIssue(doc)
  play(status === 'extracted' ? 'success' : 'warning')
}

/** A purchase order approved above the approver's delegated power becomes a real finding. */
function raiseIssue(doc: AuditDocument) {
  const { amount, approvedBy, poNumber, vendor } = doc.fields
  const limit = typeof approvedBy === 'string' ? LIMITS[approvedBy] : undefined
  if (doc.kind !== 'purchase_order' || typeof amount !== 'number' || !limit || amount <= limit) return
  const a = useAudit.getState()
  if (a.findings.some((x) => x.evidence.some((e) => e.docId === doc.id))) return
  const f: Finding = {
    id: nextNo('F-', a.findings.map((x) => x.id)), ruleId: a.rules.find((x) => /approval/i.test(x.name))?.id ?? 'R01', area: 'procurement', severity: 'high',
    title: `${vendor} order approved above the approver's limit`,
    summary: `A purchase order for ${formatINR(amount)} was approved by a ${approvedBy}, whose limit is ${formatINR(limit)}.`,
    reason: `Approval authority exceeded by ${formatINR(amount - limit)}`, amount, divisionId: doc.divisionId,
    evidence: [{ docId: doc.id, label: String(poNumber ?? doc.name), kind: 'purchase_order' }], confidence: doc.confidence, status: 'open', createdAt: new Date().toISOString(),
  }
  useAudit.setState((s) => ({ findings: [f, ...s.findings] })) // ponytail: re-running the full audit rebuilds findings from rules and drops this demo one
  a.log('finding', `New finding ${f.id}: ${f.title}`)
}

function batch(items: Incoming[], gap = 450) {
  items.forEach((it, i) => setTimeout(() => run(it), i * gap))
}

const FALLBACK: Division = { id: 'D0', name: 'Head Office', location: 'Agartala HO', officer: 'R. Majumder', email: 'accounts@tsicl-demo.in' }
let mailNo = 0
/** "Simulate incoming email": a division officer sends 1-2 attachments. */
export function simulateEmail(divisions: Division[]) {
  const n = mailNo++
  const div = divisions.length ? (n === 0 ? divisions.find((d) => /dharmanagar/i.test(d.location)) : undefined) ?? divisions[(n * 3 + 1) % divisions.length] : FALLBACK
  const loc = div.location.replace(/\s*HO$/, '')
  const mail = MAILS[n % MAILS.length]
  const subject = fill(mail.subject, loc)
  play('notify')
  batch(mail.files.map((f) => ({ name: fill(f.name, loc.replace(/\s+/g, '_')), source: 'email', from: div.email, subject, division: div, issue: f.issue })))
}

/** Dropped / chosen files. Only name, size and type are read; nothing is uploaded anywhere. */
export function ingestFiles(files: File[], divisions: Division[]) {
  if (!files.length) return
  play('notify')
  batch(files.slice(0, 8).map((f) => ({
    name: f.name, mime: f.type, source: 'upload' as const,
    division: divisions.find((d) => f.name.toLowerCase().includes(d.location.toLowerCase().replace(/\s*ho$/, ''))) ?? (divisions.length ? divisions[hash(f.name) % divisions.length] : FALLBACK),
  })))
}

export const setVerdict = (docId: string, key: string, v: 'ok' | 'fixed') => useFlow.setState((s) => ({ verdict: { ...s.verdict, [`${docId}:${key}`]: v } }))

/** A person confirmed the details: the document is done and its confidence is human-backed. */
export function confirmDocument(doc: AuditDocument, keys: string[]) {
  const a = useAudit.getState()
  keys.forEach((k) => { if (!useFlow.getState().verdict[`${doc.id}:${k}`]) setVerdict(doc.id, k, 'ok') })
  a.updateDocument(doc.id, { status: 'extracted', confidence: Math.max(doc.confidence, 0.97) })
  a.log('decision', `Auditor checked the details of ${doc.name}`)
  raiseIssue({ ...doc, status: 'extracted' })
  play('confirm')
}

