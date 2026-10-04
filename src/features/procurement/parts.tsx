import type { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, CircleDot, Files, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { IssueKey } from './analysis'

// Full class strings so Tailwind can see them. Severity = colour + icon + word.
export const ISSUE: Record<IssueKey, { label: string; icon: typeof AlertOctagon; cls: string }> = {
  above_limit: { label: 'Above limit', icon: AlertOctagon, cls: 'bg-sev-critical/10 text-sev-critical ring-sev-critical/20' },
  paid_early: { label: 'Paid before goods received', icon: AlertTriangle, cls: 'bg-sev-high/10 text-sev-high ring-sev-high/20' },
  invoice_over: { label: 'Invoice > PO', icon: AlertTriangle, cls: 'bg-sev-high/10 text-sev-high ring-sev-high/20' },
  one_quote: { label: '1 quote', icon: CircleDot, cls: 'bg-sev-medium/10 text-sev-medium ring-sev-medium/25' },
  split: { label: 'Possible split', icon: Layers, cls: 'bg-sev-medium/10 text-sev-medium ring-sev-medium/25' },
}
export const ISSUE_ORDER: IssueKey[] = ['above_limit', 'one_quote', 'paid_early', 'invoice_over', 'split']

export function IssueChip({ issue, className }: { issue: IssueKey; className?: string }) {
  const t = useT()
  const { label, icon: Icon, cls } = ISSUE[issue]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset', cls, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(label)}
    </span>
  )
}

export function Section({ title, caption, children, className, id }: { title: string; caption?: string; children: ReactNode; className?: string; id?: string }) {
  const t = useT()
  return (
    <section id={id} className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{t(title)}</h2>
      {caption && <p className="mt-0.5 text-[13px] text-muted-foreground">{t(caption)}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export const NoData = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-[13px] text-muted-foreground">
    <Files className="size-4 shrink-0" aria-hidden />{children}
  </div>
)
