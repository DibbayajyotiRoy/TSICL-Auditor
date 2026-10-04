import { useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, FastForward, Hourglass, Plus } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/kit'
import { BlurFade } from '@/components/ui/blur-fade'
import { Button } from '@/components/ui/button'
import { useAudit } from '@/data/store'
import { AutomationRules, RULES, RULE_FOR_STAGE } from '@/features/requests/AutomationRules'
import { CLOCK_MS, ClockOverlay, sleep } from '@/features/requests/FastForward'
import { NewRequestDialog } from '@/features/requests/NewRequestDialog'
import { RequestCard } from '@/features/requests/RequestCard'
import { deadlineInfo, simToday, useClock, useResetClockWithDemo, type RequestState } from '@/features/requests/lib'
import { useT, tr } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { cn } from '@/lib/utils'

const PILLS = [
  { key: 'waiting', label: 'Waiting', icon: Hourglass, tone: 'text-sev-low' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, tone: 'text-sev-critical' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'text-sev-ok' },
] as const

export default function Requests() {
  const t = useT()
  const requests = useAudit((s) => s.requests)
  const advance = useAudit((s) => s.advanceRequest)
  const offset = useClock((s) => s.offset)
  useResetClockWithDemo()
  const today = simToday(offset)

  const [filter, setFilter] = useState<RequestState | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dialog, setDialog] = useState(false)
  const [running, setRunning] = useState(false)
  const [clock, setClock] = useState(false)
  const [clockFrom, setClockFrom] = useState(today) // frozen at click so the overlay doesn't jump when the offset changes
  const [rulesOn, setRulesOn] = useState<Record<string, boolean>>(() => Object.fromEntries(RULES.map((r) => [r.id, true])))
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const counts: Record<RequestState, number> = { waiting: 0, overdue: 0, completed: 0 }
  for (const r of requests) counts[deadlineInfo(r, today).state]++
  const shown = filter ? requests.filter((r) => deadlineInfo(r, today).state === filter) : requests

  // Demo: let a week pass, then push every open request one step along, one at a time.
  const fastForward = async () => {
    if (running) return
    const { requests: all, divisions } = useAudit.getState()
    const targets = all.filter((r) => r.stage !== 'completed' && r.stage !== 'escalated')
    if (!targets.length) {
      toast(tr('Nothing to chase right now'), { description: tr('Every request is either complete or waiting for your decision.') })
      return
    }
    play('notify') // the click itself; the staggered steps below stay silent
    setRunning(true)
    setClockFrom(today)
    setClock(true)
    await sleep(CLOCK_MS + 100)
    if (!alive.current) return
    useClock.setState((s) => ({ offset: s.offset + 7 }))
    setClock(false)
    await sleep(400)
    let reminders = 0
    let recommended = 0
    for (const [i, t] of targets.entries()) {
      if (!alive.current) return
      const name = divisions.find((d) => d.id === t.divisionId)?.name ?? 'the department'
      const rule = RULES.find((r) => r.id === RULE_FOR_STAGE[t.stage])
      if (rule && !rulesOn[rule.id]) {
        toast(`${tr('Paused for')} ${name}`, { description: `"${tr(rule.when)}" ${tr('is switched off.')}` })
      } else {
        advance(t.id)
        const next = useAudit.getState().requests.find((x) => x.id === t.id)?.stage
        if (next === 'escalated') {
          recommended++
          toast.warning(tr('Escalation recommended — needs your approval'), { description: name })
        } else if (next === 'reminder_1' || next === 'reminder_2') {
          reminders++
          toast(`${tr('Reminder')} #${next === 'reminder_1' ? 1 : 2} ${tr('sent to')} ${name}`, { description: t.subject })
        }
      }
      if (i < targets.length - 1) await sleep(600)
    }
    await sleep(500)
    toast.success(tr('One week later'), { description: `${reminders} ${tr(reminders === 1 ? 'reminder' : 'reminders')} ${tr('sent')}` + (recommended ? `, ${recommended} ${tr(recommended === 1 ? 'escalation needs' : 'escalations need')} ${tr('your approval.')}` : '.') })
    if (alive.current) setRunning(false)
  }

  return (
    <MotionConfig reducedMotion="user">
      <PageHeader
        title="Requests & Follow-ups"
        subtitle="The assistant drafts what the audit needs from each department, reminds them on schedule, and recommends escalation only if needed. You approve what goes out."
        actions={<>
          <Button variant="outline" className="h-10 px-4" disabled={running || requests.length === 0} onClick={fastForward} title={t('Demo: watch a week of follow-ups happen')}>
            <FastForward aria-hidden />{t('Fast-forward 1 week')}
          </Button>
          <Button className="h-10 px-4" onClick={() => { play('open'); setDialog(true) }}><Plus aria-hidden />{t('New request')}</Button>
        </>}
      />

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('Filter requests')}>
        {PILLS.map(({ key, label, icon: Icon, tone }) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(filter === key ? null : key)}
            className={cn('inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm outline-none transition-[border-color,background-color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]',
              filter === key ? 'border-foreground/40 bg-foreground/5' : 'border-border bg-card hover:border-foreground/25')}>
            <Icon className={cn('size-4', tone)} aria-hidden />
            <span className="text-muted-foreground">{t(label)}</span>
            <span className="font-semibold tabular-nums">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4" aria-label="Requests">
          {requests.length === 0 ? (
            <EmptyState title={t('No requests yet')} body={t('Ask a department for the documents the audit needs. The assistant drafts the email and follows up for you.')}
              action={<Button className="h-10 px-4" onClick={() => setDialog(true)}><Plus aria-hidden />{t('New request')}</Button>} />
          ) : shown.length === 0 ? (
            <EmptyState title={t('Nothing here')} body={t('No requests match this filter.')} action={<Button variant="outline" className="h-10 px-4" onClick={() => setFilter(null)}>{t('Show all')}</Button>} />
          ) : shown.map((r, i) => (
            <BlurFade key={r.id} delay={Math.min(i, 8) * 0.05}>
              <RequestCard r={r} today={today} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
            </BlurFade>
          ))}
        </section>
        <aside className="lg:sticky lg:top-6">
          <AutomationRules on={rulesOn} onChange={(id, v) => setRulesOn((s) => ({ ...s, [id]: v }))} />
        </aside>
      </div>

      <ClockOverlay show={clock} from={clockFrom} />
      <NewRequestDialog open={dialog} onOpenChange={setDialog} onSent={(id) => { setFilter(null); setOpenId(id) }} />
    </MotionConfig>
  )
}
