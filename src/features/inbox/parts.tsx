// Small shared pieces for the inbox: kind chip, sender avatar, "AI is reading" loader, sender and time helpers.
import { motion, useReducedMotion } from 'motion/react'
import { Banknote, ClipboardList, Database, FileSignature, FileSpreadsheet, Handshake, Landmark, PackageCheck, ReceiptText, Recycle, Scale, UploadCloud, type LucideIcon } from 'lucide-react'
import type { AuditDocument, DocKind, Division } from '@/data/types'
import { DotLoader } from '@/components/ui/dot-loader'
import { useT } from '@/lib/i18n'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { DEMO_NOW, KIND_LABEL } from './model'

const KIND_ICON: Record<DocKind, LucideIcon> = {
  purchase_order: ClipboardList, invoice: ReceiptText, quotation: Scale, grn: PackageCheck, payment_voucher: Banknote,
  approval_note: FileSignature, bank_statement: Landmark, asset_register: FileSpreadsheet, contract: Handshake, scrap_auction: Recycle,
}

/** Typed category chip. Neutral on purpose: colour is kept for meaning (severity, AI). */
export function KindChip({ kind, animate = false, className }: { kind: DocKind; animate?: boolean; className?: string }) {
  const t = useT()
  const Icon = KIND_ICON[kind]
  return (
    <motion.span
      initial={animate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 text-[11px] font-medium text-foreground/70', className)}
    >
      <Icon className="size-3" aria-hidden />
      {t(KIND_LABEL[kind])}
    </motion.span>
  )
}

// ---------- sender ----------
const TITLES = /^(shri|smt|sri|dr|mr|mrs|ms)\.?\s+/i
export function initials(name: string) {
  const w = name.replace(TITLES, '').split(/[\s.]+/).filter((x) => /^[A-Za-z]/.test(x))
  return ((w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] ?? '?').slice(0, 2)) || '?').toUpperCase()
}
export function senderName(doc: AuditDocument, division?: Division) {
  if (doc.source === 'upload') return 'Uploaded by you'
  if (doc.source === 'erp') return 'ERP sync'
  if (division?.officer && (!doc.from || doc.from === division.email)) return division.officer
  const local = (doc.from ?? '').split('@')[0].split(/[._-]+/).filter(Boolean)
  return local.length ? local.map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') : division?.officer ?? 'Unknown sender'
}
export function SenderAvatar({ doc, name, className }: { doc: AuditDocument; name: string; className?: string }) {
  const Icon = doc.source === 'upload' ? UploadCloud : doc.source === 'erp' ? Database : undefined
  return (
    <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-medium text-foreground/70', className)}>
      {Icon ? <Icon className="size-4" /> : initials(name)}
    </span>
  )
}

/** Session documents are stamped with the real clock; seeded ones are shown relative to the demo date. */
export function timeLabel(doc: AuditDocument, isSession: boolean) {
  const age = (isSession ? Date.now() : DEMO_NOW) - new Date(doc.receivedAt).getTime()
  return age > 7 * 864e5 ? formatDate(doc.receivedAt) : timeAgo(doc.receivedAt, isSession ? Date.now() : DEMO_NOW)
}

// ---------- "AI is working" ----------
const row = (r: number) => Array.from({ length: 7 }, (_, c) => r * 7 + c)
const SCAN = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map(row)
const DIAG = Array.from({ length: 13 }, (_, k) => Array.from({ length: 49 }, (_, i) => i).filter((i) => Math.floor(i / 7) + (i % 7) === k))

/** Scanning dots + label. Static when the viewer prefers reduced motion. */
export function Working({ label, variant = 'scan' }: { label: string; variant?: 'scan' | 'check' }) {
  const reduce = useReducedMotion()
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ai">
      <DotLoader frames={variant === 'scan' ? SCAN : DIAG} isPlaying={!reduce} duration={variant === 'scan' ? 90 : 70} className="gap-px" dotClassName="size-1 bg-ai/20 transition-colors duration-100 [&.active]:bg-ai" aria-hidden />
      {label}
    </span>
  )
}

/** Five tiny segments: how far a document has travelled. */
export function StageDots({ stage }: { stage: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={cn('h-1 w-4 rounded-full transition-colors duration-300', i <= stage ? 'bg-ai' : 'bg-muted')} />)}
    </span>
  )
}
