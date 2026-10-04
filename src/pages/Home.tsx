import { useNavigate } from 'react-router-dom'
import { FileText, Gavel, IndianRupee, ShieldAlert } from 'lucide-react'
import { KpiCard } from '@/components/kit'
import { BlurFade } from '@/components/ui/blur-fade'
import { useT } from '@/lib/i18n'
import { ActivityFeed } from '@/features/home/ActivityFeed'
import { Attention } from '@/features/home/Attention'
import { Coverage } from '@/features/home/Coverage'
import { Flow } from '@/features/home/Flow'
import { Headline, Hero } from '@/features/home/Hero'
import { RiskSection } from '@/features/home/RiskSection'
import { useHomeStats } from '@/features/home/stats'
import { useAutomation } from '@/features/home/useAutomation'

export default function Home() {
  const t = useT()
  const go = useNavigate()
  const s = useHomeStats()
  useAutomation()

  const open = s.open.length
  const kpis = [
    { label: 'Transactions reviewed', value: s.txValue, format: 'inr' as const, icon: <IndianRupee />, to: '/checks',
      tone: 'neutral' as const, hint: `${s.txCount.toLocaleString('en-IN')} ${t('transactions checked')}` },
    { label: 'Documents processed', value: s.docsProcessed, icon: <FileText />, to: '/inbox',
      tone: 'neutral' as const, hint: `${t('of')} ${s.docsRequested.toLocaleString('en-IN')} ${t('requested')}` },
    { label: 'Exceptions identified', value: s.exceptions, icon: <ShieldAlert />, to: '/findings',
      tone: 'neutral' as const, hint: `${open} ${t('open')} · ${s.decided} ${t('decided')}` },
    { label: 'Waiting for your decision', value: open, icon: <Gavel />, to: '/findings',
      tone: open ? 'warn' as const : 'good' as const, hint: open ? t('AI drafts, you decide') : t('All caught up') },
  ]

  return (
    <div className="space-y-6">
      <Hero />
      <Headline s={s} />
      <Flow s={s} />
      <section data-tour="kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ to, label, ...k }, i) => (
          <BlurFade key={label} delay={0.3 + 0.06 * i} className="[&>button]:size-full">
            <KpiCard label={t(label)} onClick={() => go(to)} {...k} />
          </BlurFade>
        ))}
      </section>
      <Attention s={s} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3"><RiskSection s={s} /></div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Coverage progress={s.progress} />
          <div className="relative min-h-[340px] flex-1"><ActivityFeed /></div>
        </div>
      </div>
    </div>
  )
}
