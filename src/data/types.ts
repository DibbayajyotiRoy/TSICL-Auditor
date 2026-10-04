// Shared domain contract. Workers: do NOT change existing fields; additive optional fields only.

// Demo "today" — the whole app reasons relative to this date. Q2 FY 2026-27 (Jul–Sep 2026).
export const TODAY = '2026-10-04'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Area = 'procurement' | 'receivables' | 'cash_bank' | 'fixed_assets' | 'establishment' | 'compliance' | 'scrap' | 'internal_controls' | 'cag'

export interface Division {
  id: string
  name: string // e.g. "Handloom Division"
  location: string // e.g. "Agartala HO", "Dharmanagar"
  officer: string
  email: string
}

export type DocKind =
  | 'purchase_order' | 'invoice' | 'quotation' | 'grn' | 'payment_voucher'
  | 'approval_note' | 'bank_statement' | 'asset_register' | 'contract' | 'scrap_auction'

export interface AuditDocument {
  id: string // "DOC-0001"
  name: string // file name
  kind: DocKind
  divisionId: string
  receivedAt: string // ISO
  source: 'email' | 'upload' | 'erp'
  from?: string // sender email
  status: 'processing' | 'extracted' | 'needs_review'
  confidence: number // 0..1 extraction confidence
  fields: Record<string, string | number> // extracted key/values (vendor, amount, poNumber, ...)
  pages: number
}

export type FinancialYear = 'FY 2024-25' | 'FY 2025-26' | 'FY 2026-27'

export interface PurchaseOrder {
  id: string // "PO-2026-184"
  vendor: string
  item: string
  divisionId: string
  date: string
  amount: number // INR
  approvedBy: string // designation e.g. "General Manager"
  approverLimit: number // delegated financial power of approver (INR)
  quotations: number
  grnDate?: string
  invoiceAmount?: number
  invoiceNo?: string
  paymentDate?: string
  docIds: string[]
}

export interface Receivable {
  id: string
  customer: string
  divisionId: string
  invoiceNo: string
  invoiceDate: string
  amount: number // outstanding
  lastPaymentDate?: string
}

export interface BankReceipt {
  id: string
  date: string
  amount: number
  narration: string
  matchedReceivableId?: string // undefined = unmatched
}

export interface Asset {
  id: string
  tag: string // "TSICL-000193"
  name: string
  category: 'IT' | 'Furniture' | 'Vehicle' | 'Machinery' | 'Building' | 'Other'
  cost: number
  purchaseDate: string
  location: string
  assignedTo?: string
  lastVerified?: string // ISO; undefined = never physically verified
  verification?: 'found' | 'missing' | 'damaged' | 'pending'
}

export interface Rule {
  id: string // "R01"
  name: string // short: "Approval above delegated power"
  scopeRef?: string // tender scope clause, e.g. "Procurement — delegation of financial powers"
  plain: string // non-technical one-liner
  area: Area
  severity: Severity
  enabled: boolean
}

export interface EvidenceRef {
  docId?: string
  label: string // "PO-2026-184"
  kind: DocKind | 'ledger' | 'register' | 'bank'
}

export type FindingStatus = 'open' | 'confirmed' | 'rejected' | 'investigating'

export interface Finding {
  id: string // "F-247"
  ruleId: string
  area: Area
  severity: Severity
  title: string // plain language
  summary: string // 1-2 sentence plain explanation
  reason: string // precise: "Approval authority exceeded by ₹2,42,000"
  amount: number // INR at risk
  divisionId: string
  evidence: EvidenceRef[]
  confidence: number // 0..1
  status: FindingStatus
  createdAt: string
  note?: string // auditor note
  /** Provenance — "why did the AI say this": the exact document values the rule fired on. */
  basis?: { docId?: string; doc: string; field: string; value: string }[]
  /** Which engine produced it, e.g. "Rule engine v1 (deterministic)" */
  engine?: string
  /** Tender scope clause this check derives from, e.g. "EOI Scope: Procurement — delegation of financial powers" */
  scopeRef?: string
}

export type RequestStage = 'sent' | 'reminder_1' | 'reminder_2' | 'escalated' | 'completed'

export interface DocRequest {
  id: string
  divisionId: string
  subject: string
  items: { label: string; received: boolean }[]
  sentAt: string
  deadline: string
  stage: RequestStage
  /** stage 'escalated' means escalation RECOMMENDED; a human must approve before it is sent. */
  escalationApproved?: boolean
  timeline: { at: string; event: string }[]
}

export interface ActivityEvent {
  id: string
  at: string
  kind: 'doc_received' | 'finding' | 'reminder' | 'escalation' | 'decision' | 'ai' | 'report'
  text: string // plain language, shown in live feed
}

export const AREA_LABEL: Record<Area, string> = {
  procurement: 'Purchases & Work Orders',
  receivables: 'Money Owed to Us',
  cash_bank: 'Cash & Bank',
  fixed_assets: 'Assets & Equipment',
  establishment: 'Staff & Establishment',
  compliance: 'Rules & Compliance',
  scrap: 'Scrap & Surplus Disposal',
  internal_controls: 'Internal Controls',
  cag: 'CAG Observations',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Urgent', high: 'Important', medium: 'Check soon', low: 'Minor',
}
