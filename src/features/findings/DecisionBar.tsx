import { useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import type { Finding, FindingStatus } from '@/data/types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Kbd, STATUS_LABEL, useHotkeys } from './shared'

const QUICK = ['Approved by the competent authority', 'Documents explain it', 'Already reported elsewhere']

/** Sticky "What should happen?" bar. The AI only suggests; every button here is the auditor's call. */
export function DecisionBar({ finding, onDecide }: { finding: Finding; onDecide: (s: FindingStatus, note?: string) => void }) {
  const t = useT()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const shown = () => !!ref.current?.offsetParent // pane may be display:none on mobile
  const canReject = reason.trim().length >= 3
  const submit = () => { if (!canReject) return; setRejectOpen(false); onDecide('rejected', reason.trim()) }
  useHotkeys({
    c: () => shown() && onDecide('confirmed'),
    i: () => shown() && onDecide('investigating'),
    r: () => shown() && setRejectOpen(true),
  })
  const s = finding.status
  const btn = 'h-11 gap-2 text-[15px] transition-[background-color,transform] duration-150 active:scale-[0.97] aria-pressed:ring-2 aria-pressed:ring-foreground/25 sm:px-4'
  return (
    <div ref={ref} data-tour="decision"
      className="sticky bottom-3 z-20 rounded-2xl border border-border bg-card/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_8px_30px_-12px_rgb(0_0_0/0.22)] backdrop-blur-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 px-1">
          <p className="text-[14px] font-semibold tracking-tight text-foreground">{t('What should happen?')}</p>
          <p className="text-xs text-muted-foreground">{s === 'open' ? t('AI-assisted · the auditor decides') : <>{t('Marked:')} {t(STATUS_LABEL[s])}. {t('You can change this.')}</>}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button className={cn(btn, 'col-span-2 sm:col-span-1')} aria-pressed={s === 'confirmed'} onClick={() => onDecide('confirmed')}>
            <Check />{t('Confirm finding')} <Kbd>C</Kbd>
          </Button>
          <Button variant="outline" className={btn} aria-pressed={s === 'investigating'} onClick={() => onDecide('investigating')}>
            <Search />{t('Investigate')} <Kbd>I</Kbd>
          </Button>
          <Popover open={rejectOpen} onOpenChange={(o) => { setRejectOpen(o); if (o) setReason('') }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={btn} aria-pressed={s === 'rejected'}><X />{t('Not an issue')} <Kbd>R</Kbd></Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" sideOffset={10} className="w-[min(22rem,calc(100vw-2rem))] gap-3 rounded-xl p-3">
              <label htmlFor="reject-reason" className="text-[14px] font-medium">{t('Why is this not an issue?')}</label>
              <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('A short reason for the audit file')} aria-required
                className="min-h-20" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }} />
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => setReason(q)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-foreground/25 hover:text-foreground">{t(q)}</button>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="h-10" onClick={() => setRejectOpen(false)}>{t('Cancel')}</Button>
                <Button className="h-10" disabled={!canReject} onClick={submit}>{t('Mark as not an issue')}</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
