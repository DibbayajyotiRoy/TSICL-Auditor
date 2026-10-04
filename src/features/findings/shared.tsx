import { useEffect } from 'react'
import type { EvidenceRef, FindingStatus, Severity } from '@/data/types'

export const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']

// Static class strings so Tailwind can see them.
export const SEV_STYLE: Record<Severity, { dot: string; box: string; stroke: string; fill: string; text: string }> = {
  critical: { dot: 'bg-sev-critical', box: 'border-sev-critical/25 bg-sev-critical/[0.06]', stroke: 'stroke-sev-critical', fill: 'fill-sev-critical', text: 'text-sev-critical' },
  high: { dot: 'bg-sev-high', box: 'border-sev-high/25 bg-sev-high/[0.06]', stroke: 'stroke-sev-high', fill: 'fill-sev-high', text: 'text-sev-high' },
  medium: { dot: 'bg-sev-medium', box: 'border-sev-medium/30 bg-sev-medium/[0.07]', stroke: 'stroke-sev-medium', fill: 'fill-sev-medium', text: 'text-sev-medium' },
  low: { dot: 'bg-sev-low', box: 'border-sev-low/25 bg-sev-low/[0.06]', stroke: 'stroke-sev-low', fill: 'fill-sev-low', text: 'text-sev-low' },
}

export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: 'Waiting for you', confirmed: 'Confirmed', rejected: 'Rejected', investigating: 'Investigating',
}

export const KIND_LABEL: Record<EvidenceRef['kind'], string> = {
  purchase_order: 'Purchase order', quotation: 'Quotation', approval_note: 'Approval note', grn: 'Goods received',
  invoice: 'Invoice', payment_voucher: 'Payment', bank_statement: 'Bank statement', asset_register: 'Asset register',
  contract: 'Contract', scrap_auction: 'Scrap auction', ledger: 'Ledger', register: 'Register', bank: 'Bank',
}

/** Left-to-right order of the paper trail. Unknown kinds go last, keeping their original order. */
const KIND_RANK: Partial<Record<EvidenceRef['kind'], number>> = {
  purchase_order: 0, quotation: 1, approval_note: 2, grn: 3, invoice: 4, payment_voucher: 5,
}
export const byTrail = (a: EvidenceRef, b: EvidenceRef) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9)

/** Global shortcuts that stay quiet while typing or while any dialog / popover / sheet is open. */
export function useHotkeys(map: Record<string, () => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if ((e.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return
      const fn = map[e.key.toLowerCase()]
      if (fn) { e.preventDefault(); fn() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [map, enabled])
}

export function Kbd({ children }: { children: string }) {
  return <kbd className="hidden h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">{children}</kbd>
}
