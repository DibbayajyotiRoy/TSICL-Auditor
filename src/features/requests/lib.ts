import { useEffect } from 'react'
import { create } from 'zustand'
import { Bell, BellRing, Send, ShieldAlert } from 'lucide-react'
import { TODAY, useAudit } from '@/data/store'
import { tr } from '@/lib/i18n'
import { daysBetween } from '@/lib/utils'
import type { DocRequest, RequestStage } from '@/data/types'

/** The four automated steps, in order. */
export const STEPS = [
  { stage: 'sent', label: 'Sent', icon: Send },
  { stage: 'reminder_1', label: 'Reminder 1', icon: Bell },
  { stage: 'reminder_2', label: 'Reminder 2', icon: BellRing },
  { stage: 'escalated', label: 'Escalation recommended', icon: ShieldAlert },
] as const satisfies readonly { stage: RequestStage; label: string; icon: unknown }[]

export const stepIndex = (s: RequestStage) => STEPS.findIndex((x) => x.stage === s)

export const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 864e5).toISOString().slice(0, 10)

// Demo clock: "Fast-forward 1 week" moves this page's idea of today, so deadlines visibly turn overdue.
// ponytail: lives in memory only; resets on reload. Persist if the demo must survive refresh.
export const useClock = create<{ offset: number }>(() => ({ offset: 0 }))
// The store's demo reset also resets the clock (the page may be unmounted when it happens).
let seenReset = useAudit.getState().lastReset
export function useResetClockWithDemo() {
  const lastReset = useAudit((s) => s.lastReset)
  useEffect(() => {
    if (lastReset === seenReset) return
    seenReset = lastReset
    useClock.setState({ offset: 0 })
  }, [lastReset])
}
export const simToday = (offset: number) => addDays(TODAY, offset)

export type RequestState = 'waiting' | 'overdue' | 'completed'
export function deadlineInfo(r: DocRequest, today: string) {
  const days = daysBetween(today, r.deadline.slice(0, 10))
  const state: RequestState = r.stage === 'completed' ? 'completed' : days < 0 ? 'overdue' : 'waiting'
  const n = Math.abs(days)
  const unit = n === 1 ? tr('day') : tr('days')
  const text = days < 0 ? `${n} ${unit} ${tr('overdue')}` : days === 0 ? tr('Due today') : days === 1 ? tr('Due tomorrow') : `${n} ${tr('days left')}`
  return { days, state, text }
}
