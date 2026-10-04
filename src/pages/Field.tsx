import { useMemo } from 'react'
import { AiInsight, PageHeader } from '@/components/kit'
import { useAudit } from '@/data/store'
import { SamplingCard } from '@/features/field/SamplingCard'
import { VisitPlanner } from '@/features/field/VisitPlanner'
import { buildRoute, riskByDivision } from '@/features/field/planner'
import { sampleSize } from '@/features/field/sampling'
import { useT } from '@/lib/i18n'

const H2 = 'text-lg font-semibold tracking-tight'

export default function Field() {
  const t = useT()
  const divisions = useAudit((s) => s.divisions)
  const findings = useAudit((s) => s.findings)
  const pos = useAudit((s) => s.purchaseOrders.length)
  const first = useMemo(() => buildRoute(riskByDivision(divisions, findings))[0]?.risk, [divisions, findings])
  const n = sampleSize(pos, 95, 0.05, 0.5)

  return (
    <div className="space-y-8">
      <PageHeader title="Field Visits & Sampling" subtitle="How many items to check, and which offices to visit outside Agartala." />

      <AiInsight ask="Which divisions should we visit first this quarter, and how many purchases should we sample?">
        {first
          ? <>{t('Start with')} <strong className="font-semibold">{first.division.name}</strong> ({first.division.location}, ~{first.km} {t('km away')}): {t('it has')} <span className="tabular-nums">{first.open}</span> {t('open')} {first.open === 1 ? t('issue') : t('issues')}{first.urgent > 0 && <>, <span className="tabular-nums">{first.urgent}</span> {t('Urgent')}</>}. </>
          : <>{t('No office outside Head Office needs a visit right now.')} </>}
        {pos > 0 && <>{t('For purchases, checking')} <span className="tabular-nums">{n}</span> {t('of')} <span className="tabular-nums">{pos}</span> {t('gives 95% confidence, and every flagged item is checked on top.')}</>}
      </AiInsight>

      <section className="space-y-4">
        <div>
          <h2 className={H2}>{t('Sampling methodology (as required in the EOI)')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('How many items must be checked for the result to hold for all of them.')}</p>
        </div>
        <SamplingCard />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className={H2}>{t('Field visit planner')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('Offices ranked by how much needs a second look, with distance from Agartala HO.')}</p>
        </div>
        <VisitPlanner />
      </section>
    </div>
  )
}
