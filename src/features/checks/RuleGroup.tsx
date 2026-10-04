import { Sparkles } from 'lucide-react'
import { SeverityBadge } from '@/components/kit'
import { Switch } from '@/components/ui/switch'
import { BlurFade } from '@/components/ui/blur-fade'
import { useAudit } from '@/data/store'
import type { Area, Rule } from '@/data/types'
import { play } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { areaName } from './areas'

function RuleRow({ rule, found }: { rule: Rule; found: number }) {
  const t = useT()
  const toggleRule = useAudit((s) => s.toggleRule)
  const id = `rule-${rule.id}`
  const isNew = rule.id.startsWith('U') && found === 0
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-start gap-4 px-5 py-4 transition-colors duration-150 hover:bg-muted/40">
      <div className={cn('min-w-0 flex-1 transition-opacity duration-200', !rule.enabled && 'opacity-50')}>
        <p className="text-pretty text-[15px] font-medium leading-snug text-foreground">{rule.plain}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{rule.name}</p>
        {rule.scopeRef && <p className="mt-0.5 text-pretty text-xs text-muted-foreground/80">{t('From TSICL audit scope:')} {rule.scopeRef}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <SeverityBadge severity={rule.severity} />
          {!rule.enabled ? <span className="text-muted-foreground">{t("Paused — won't run next time")}</span>
            : isNew ? <span className="inline-flex items-center gap-1 font-medium text-ai"><Sparkles className="size-3.5" aria-hidden />{t('New — will run in next audit')}</span>
            : found > 0 ? <span className="font-medium tabular-nums text-foreground">{t('found')} {found} {found === 1 ? t('issue') : t('issues')}</span>
            : <span className="text-sev-ok">{t('No issues found')}</span>}
        </div>
      </div>
      <Switch id={id} checked={rule.enabled} aria-label={rule.plain} className="mt-0.5"
        onCheckedChange={() => { toggleRule(rule.id); play('toggle') }} />
    </label>
  )
}

export function RuleGroup({ area, rules, counts, delay }: { area: Area; rules: Rule[]; counts: Map<string, number>; delay: number }) {
  const t = useT()
  const paused = rules.filter((r) => !r.enabled).length
  const issues = rules.reduce((a, r) => a + (counts.get(r.id) ?? 0), 0)
  return (
    <BlurFade delay={delay} className="min-w-0">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-balance text-[15px] font-semibold tracking-tight">{t(areaName(area))}</h2>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {rules.length} {rules.length === 1 ? t('check') : t('checks')}{paused > 0 && <> · {paused} {t('paused')}</>}{issues > 0 && <> · {issues} {t('found')}</>}
          </p>
        </header>
        <div className="divide-y divide-border">
          {rules.map((r) => <RuleRow key={r.id} rule={r} found={counts.get(r.id) ?? 0} />)}
        </div>
      </section>
    </BlurFade>
  )
}
