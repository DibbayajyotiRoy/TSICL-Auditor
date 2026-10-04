import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { AiInsight, PageHeader } from '@/components/kit'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { useAudit } from '@/data/store'
import { Coverage } from '@/features/checks/Coverage'
import { NewCheck } from '@/features/checks/NewCheck'
import { RuleGroup } from '@/features/checks/RuleGroup'
import { RunAudit } from '@/features/checks/RunAudit'
import { AREA_ORDER } from '@/features/checks/areas'
import { play } from '@/lib/sound'
import { useT } from '@/lib/i18n'

export default function Checks() {
  const t = useT()
  const rules = useAudit((s) => s.rules)
  const findings = useAudit((s) => s.findings)
  const [running, setRunning] = useState(false)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of findings) m.set(f.ruleId, (m.get(f.ruleId) ?? 0) + 1)
    return m
  }, [findings])
  const groups = useMemo(() => AREA_ORDER.map((area) => ({ area, rules: rules.filter((r) => r.area === area) })).filter((g) => g.rules.length > 0), [rules])
  const on = rules.filter((r) => r.enabled).length
  const top = rules.reduce<(typeof rules)[number] | undefined>((best, r) => ((counts.get(r.id) ?? 0) > (counts.get(best?.id ?? '') ?? 0) ? r : best), undefined)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Checks"
        subtitle="The rules the assistant checks every document and transaction against, derived from TSICL's internal-audit scope. Written in plain English, switch any on or off."
        actions={
          <ShimmerButton onClick={() => { play('tap'); setRunning(true) }} shimmerDuration="4s" background="oklch(0.22 0 0)" borderRadius="12px"
            className="h-11 gap-2 px-5 text-sm font-medium dark:border-white/15">
            <Play className="size-4 fill-current" aria-hidden />{t('Run full audit now')}
          </ShimmerButton>
        }
      />

      <AiInsight ask="Which audit checks find the most issues, and which should I switch on or off?">
        {top
          ? <><span className="tabular-nums">{on}</span> {t('of')} <span className="tabular-nums">{rules.length}</span> {t('checks are on. The most productive is')} “{top.name}”, {t('which has found')} <span className="tabular-nums">{counts.get(top.id)}</span> {counts.get(top.id) === 1 ? t('issue') : t('issues')}. {t('Switching a check off only stops it from running next time — nothing is deleted.')}</>
          : <><span className="tabular-nums">{on}</span> {t('of')} <span className="tabular-nums">{rules.length}</span> {t('checks are on. Run the audit to see what each one finds. Switching a check off only stops it from running next time.')}</>}
      </AiInsight>

      <Coverage rules={rules} />
      <NewCheck />

      <p className="text-sm tabular-nums text-muted-foreground">{on} {t('of')} {rules.length} {t('checks on')} · {findings.length} {findings.length === 1 ? t('issue') : t('issues')} {t('found so far')}</p>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {groups.map((g, i) => <RuleGroup key={g.area} area={g.area} rules={g.rules} counts={counts} delay={0.04 * Math.min(i, 6)} />)}
      </div>

      <RunAudit open={running} onOpenChange={setRunning} />
    </div>
  )
}
