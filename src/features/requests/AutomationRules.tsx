import { ArrowRight, Workflow } from 'lucide-react'
import type { RequestStage } from '@/data/types'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/lib/i18n'
import { play } from '@/lib/sound'

export const RULES = [
  { id: 'r1', when: 'If no reply in 3 days', then: 'send a polite reminder' },
  { id: 'r2', when: 'If still no reply 3 days later', then: 'send a firmer second reminder' },
  { id: 'r3', when: 'After 2 reminders', then: 'recommend escalating to the division head, and wait for your approval' },
  { id: 'r4', when: 'When every document is in', then: 'close the request and say thank you' },
] as const

/** Which rule lets a request leave this stage. Switch the rule off and fast-forward skips it. */
export const RULE_FOR_STAGE: Partial<Record<RequestStage, string>> = { sent: 'r1', reminder_1: 'r2', reminder_2: 'r3' }

export function AutomationRules({ on, onChange }: { on: Record<string, boolean>; onChange: (id: string, v: boolean) => void }) {
  const t = useT()
  return (
    <section data-tour="requests-auto" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-ai/10 text-ai"><Workflow className="size-4" aria-hidden /></span>
        <h2 className="text-[15px] font-semibold tracking-tight">{t('Automation rules')}</h2>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground text-pretty">{t('The assistant follows these for every request. Switch one off to pause it. You approve anything that goes beyond a reminder.')}</p>
      <ul className="mt-3 divide-y divide-border">
        {RULES.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-4 py-3">
            <label htmlFor={`rule-${r.id}`} className="min-w-0 cursor-pointer text-sm leading-snug text-pretty">
              <span className="text-muted-foreground">{t(r.when)}</span>
              <ArrowRight className="mx-1.5 inline size-3.5 -translate-y-px text-muted-foreground/70" aria-hidden />
              <span className="font-medium text-foreground">{t(r.then)}</span>
            </label>
            <Switch id={`rule-${r.id}`} checked={on[r.id]} onCheckedChange={(v) => { play('toggle'); onChange(r.id, v) }} className="mt-0.5" />
          </li>
        ))}
      </ul>
      <p className="mt-1 border-t border-border pt-3 text-xs text-muted-foreground text-pretty">{t("Every reminder is written into the request's history and the live activity feed.")}</p>
    </section>
  )
}
