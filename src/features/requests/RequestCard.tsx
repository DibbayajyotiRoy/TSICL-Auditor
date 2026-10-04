import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, Clock, ShieldAlert } from 'lucide-react'
import { useAudit } from '@/data/store'
import type { DocRequest } from '@/data/types'
import { Button } from '@/components/ui/button'
import { useT, tr } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { cn, formatDate } from '@/lib/utils'
import { STEPS, deadlineInfo, stepIndex } from './lib'

// Colour only encodes meaning: calm neutral trail, then amber -> orange -> red as the chase escalates.
const DOT = ['bg-foreground text-background', 'bg-sev-medium text-background', 'bg-sev-high text-background', 'bg-sev-critical text-background']
const FILL = ['bg-foreground/80', 'bg-sev-medium', 'bg-sev-high', 'bg-sev-critical']

function Stepper({ stage, approved }: { stage: DocRequest['stage']; approved: boolean }) {
  const t = useT()
  // once a human approves the escalation, every step is done
  const cur = stepIndex(stage) + (approved ? 1 : 0)
  return (
    <ol className="grid grid-cols-4" aria-label={t('Follow-up progress')}>
      {STEPS.map((s, i) => {
        const done = i < cur
        const active = i === cur
        const Icon = s.icon
        return (
          <li key={s.stage} aria-current={active ? 'step' : undefined} className="relative flex flex-col items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2 rounded-full bg-border">
                <motion.span
                  className={cn('block h-full origin-left rounded-full', i === cur ? FILL[i] : 'bg-foreground/80')}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i <= cur ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </span>
            )}
            <span className={cn('relative z-10 grid size-6 place-items-center rounded-full ring-4 ring-card transition-colors duration-300',
              active ? DOT[i] : done ? 'bg-foreground/80 text-background' : 'bg-muted text-muted-foreground/60')}>
              {done ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
            </span>
            <span className={cn('text-center text-[11px] leading-tight text-balance sm:text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{i === 3 && approved ? t('Escalated') : t(s.label)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Amber hand-off: the assistant only recommends; the auditor decides. */
function EscalationCard({ r, officer, unit }: { r: DocRequest; officer: string; unit: string }) {
  const t = useT()
  const approve = useAudit((s) => s.approveEscalation)
  const log = useAudit((s) => s.log)
  const [held, setHeld] = useState(false)
  const pending = r.items.filter((i) => !i.received).length
  const note = `Respected ${officer},\n\nInternal Audit asked ${unit} for ${pending} ${pending === 1 ? 'document' : 'documents'} for "${r.subject}" by ${formatDate(r.deadline)}. Two reminders have gone out without a complete reply. Kindly make sure the pending documents reach us within 3 days, or let us know what is causing the delay.`
  if (held)
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
        {t('Escalation on hold. Nothing has been sent.')}
        <Button variant="ghost" className="h-10 px-3" onClick={() => setHeld(false)}>{t('Review again')}</Button>
      </div>
    )
  return (
    <div className="mt-4 rounded-xl border border-sev-medium/30 bg-sev-medium/[0.07] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-sev-medium/15 text-sev-medium"><ShieldAlert className="size-4" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground text-pretty">{t('AI recommends escalation to')} {officer}, {t('head of')} {unit}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground text-pretty">{t('Two reminders have gone out with no complete reply. Nothing is sent until you approve.')}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{t('Draft note')}</p>
      <blockquote className="mt-1 rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-line text-foreground/90">{note}</blockquote>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="h-10 px-4" onClick={() => { approve(r.id); play('confirm'); toast.success(`${tr('Escalation sent to')} ${officer}`, { description: tr('It now shows on the MD dashboard.') }) }}>{t('Approve & send')}</Button>
        <Button variant="outline" className="h-10 px-4" onClick={() => { setHeld(true); log('decision', `Auditor held back the escalation for ${unit}`) }}>{t('Not yet')}</Button>
      </div>
    </div>
  )
}

function DeadlineChip({ r, today }: { r: DocRequest; today: string }) {
  const t = useT()
  const { state, days, text } = deadlineInfo(r, today)
  if (state === 'completed')
    return <span className="inline-flex h-6 items-center gap-1 rounded-full bg-sev-ok/10 px-2.5 text-xs font-medium text-sev-ok ring-1 ring-inset ring-sev-ok/20"><CheckCircle2 className="size-3.5" aria-hidden />{t('Completed')}</span>
  const [Icon, cls] = state === 'overdue' ? [AlertTriangle, 'bg-sev-critical/10 text-sev-critical ring-sev-critical/20']
    : days <= 2 ? [Clock, 'bg-sev-medium/10 text-sev-medium ring-sev-medium/25'] : [CalendarClock, 'bg-muted text-muted-foreground ring-border']
  return <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium tabular-nums ring-1 ring-inset', cls)}><Icon className="size-3.5" aria-hidden />{text}</span>
}

export function RequestCard({ r, open, onToggle, today }: { r: DocRequest; open: boolean; onToggle: () => void; today: string }) {
  const t = useT()
  const division = useAudit((s) => s.divisions.find((d) => d.id === r.divisionId))
  const markItemReceived = useAudit((s) => s.markItemReceived)
  const name = division?.name ?? 'Unknown unit'
  const got = r.items.filter((i) => i.received).length
  const total = r.items.length
  const recommended = r.stage === 'escalated' && !r.escalationApproved
  const completed = r.stage === 'completed'

  // brief highlight whenever the automation moves this request forward
  const prev = useRef(r.stage)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current === r.stage) return
    prev.current = r.stage
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1600)
    return () => clearTimeout(t)
  }, [r.stage])

  const receive = (i: number) => {
    const last = r.items.every((it, j) => j === i || it.received)
    markItemReceived(r.id, i)
    play(last ? 'complete' : 'success')
    if (last) toast.success(`${tr('All documents received from')} ${name}`)
  }

  return (
    <article className={cn('rounded-2xl border bg-card transition-[border-color,box-shadow] duration-300',
      flash ? 'border-ai/40 shadow-[0_0_0_4px_color-mix(in_oklch,var(--ai)_14%,transparent)]' : 'border-border hover:border-foreground/15 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.14)]')}>
      <button type="button" aria-expanded={open} aria-controls={`req-${r.id}`} onClick={onToggle}
        className="block w-full rounded-t-2xl p-5 pb-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] text-muted-foreground">{name}{division?.location ? ` · ${division.location}` : ''}</span>
            <span className="mt-1 block text-[15px] font-medium tracking-tight text-foreground text-pretty">{r.subject}</span>
            <span className="mt-1 block text-[13px] text-muted-foreground">{t('Deadline')} {formatDate(r.deadline)} · {t('asked')} {formatDate(r.sentAt)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <DeadlineChip r={r} today={today} />
            <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} aria-hidden />
          </span>
        </span>
        {total > 0 && (
          <span className="mt-4 flex items-center gap-3">
            <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.span className="block h-full origin-left rounded-full bg-sev-ok" initial={{ scaleX: 0 }} animate={{ scaleX: got / total }} transition={{ duration: 0.5, ease: 'easeOut' }} />
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{got} {t('of')} {total} {t('received')}</span>
          </span>
        )}
      </button>

      <div className="px-5 pb-5">
        {completed ? (
          <div className="flex items-center gap-2 rounded-xl bg-sev-ok/10 px-3 py-2.5 text-sm font-medium text-sev-ok">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {t('Completed — every document has been received. No more reminders will go out.')}
          </div>
        ) : (
          <>
            <Stepper stage={r.stage} approved={!!r.escalationApproved} />
            {r.escalationApproved && <p className="mt-3 text-center text-[13px] text-muted-foreground">{t('Escalated with your approval.')} {division?.officer ?? t('The division head')} {t('has been informed and it shows on the MD dashboard.')}</p>}
            {recommended && <EscalationCard r={r} officer={division?.officer ?? 'the division head'} unit={name} />}
          </>
        )}
      </div>

      <div id={`req-${r.id}`} inert={!open} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <div className="grid gap-6 border-t border-border p-5 md:grid-cols-2">
            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">{t('Documents asked for')}</h3>
              <ul className="mt-2 space-y-1">
                {r.items.length === 0 && <li className="text-sm text-muted-foreground">{t('Nothing listed yet.')}</li>}
                {r.items.map((it, i) => (
                  <li key={i} className="flex min-h-10 items-center gap-3">
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-200', it.received ? 'border-sev-ok bg-sev-ok text-background' : 'border-border')}>
                      {it.received && <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}><Check className="size-3" aria-hidden /></motion.span>}
                    </span>
                    <span className={cn('min-w-0 flex-1 text-sm text-pretty', it.received && 'text-muted-foreground')}>{t(it.label)}</span>
                    {it.received
                      ? <span className="text-xs font-medium text-sev-ok">{t('Received')}</span>
                      : <Button variant="outline" className="h-10 px-3 text-[13px]" onClick={() => receive(i)}>{t('Mark received')}</Button>}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">{t('What has happened so far')}</h3>
              <ol className="mt-3 ml-1.5 space-y-4 border-l border-border pl-5">
                {r.timeline.map((t, i) => {
                  const last = i === r.timeline.length - 1
                  return (
                    <li key={i} className="relative">
                      <span aria-hidden className={cn('absolute top-1.5 -left-[25px] size-2 rounded-full ring-4 ring-card', last ? 'bg-foreground' : 'bg-border')} />
                      <p className={cn('text-sm text-pretty', last ? 'text-foreground' : 'text-muted-foreground')}>{t.event}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{formatDate(t.at)}</p>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </article>
  )
}
