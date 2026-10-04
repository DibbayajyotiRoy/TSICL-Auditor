import { useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Banknote, Clock3, Hourglass, Scale } from 'lucide-react'
import { AiInsight, KpiCard, PageHeader } from '@/components/kit'
import { TODAY, useAudit } from '@/data/store'
import { formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { AgeingChart } from '@/features/receivables/AgeingChart'
import { BankReconciliation } from '@/features/receivables/BankReconciliation'
import { CustomerList } from '@/features/receivables/CustomerList'
import { PaymentMatching } from '@/features/receivables/PaymentMatching'
import { SectionHead } from '@/features/receivables/parts'
import { ageing, oldMoney } from '@/features/receivables/logic'

// The quarter being audited (Q2 FY 2026-27).
const Q_START = '2026-07-01'
const Q_END = '2026-09-30'

export default function Receivables() {
  const t = useT()
  const reduce = useReducedMotion()
  const recs = useAudit((s) => s.receivables)
  const divisions = useAudit((s) => s.divisions)
  const receipts = useAudit((s) => s.bankReceipts)
  const [bucket, setBucket] = useState<number | null>(null)

  const open = useMemo(() => recs.filter((r) => r.amount > 0), [recs])
  const rows = useMemo(() => ageing(open, TODAY), [open])
  const old = useMemo(() => oldMoney(open, TODAY), [open])
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const unmatched = receipts.filter((r) => !r.matchedReceivableId)
  const unmatchedSum = unmatched.reduce((s, r) => s + r.amount, 0)
  const inQ = receipts.filter((r) => r.date >= Q_START && r.date <= Q_END)
  const collected = inQ.reduce((s, r) => s + r.amount, 0)
  const collectedOpen = inQ.filter((r) => !r.matchedReceivableId).reduce((s, r) => s + r.amount, 0)

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  return (
    <div>
      <PageHeader title="Money Owed to Us" subtitle="Who owes TSICL money, for how long, and payments we received but haven't matched yet." />

      <div data-tour="kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('How much are we owed?')} value={total} format="inr" icon={<Banknote />}
          hint={`${open.length} ${open.length === 1 ? t('open invoice') : t('open invoices')}`} onClick={() => { setBucket(null); jump('owed-list') }} />
        <KpiCard label={t('Owed for over 6 months')} value={old.total} format="inr" tone={old.total ? 'bad' : 'good'} icon={<Hourglass />}
          hint={total ? `${Math.round((old.total / total) * 100)}% ${t('of everything owed')}` : undefined} onClick={() => { setBucket(old.total ? 3 : null); jump('owed-list') }} />
        <KpiCard label={t('Payments not yet matched')} value={unmatched.length} tone={unmatched.length ? 'warn' : 'good'} icon={<Scale />}
          hint={unmatched.length ? `${formatINRShort(unmatchedSum)} ${t('not yet credited')}` : 'All matched'} onClick={() => jump('unmatched')} />
        <KpiCard label={t('Collected this quarter')} value={collected} format="inr" tone="good" icon={<Clock3 />}
          hint={`Jul–Sep 2026${collectedOpen ? ` · ${formatINRShort(collectedOpen)} ${t('still to match')}` : ''}`} />
      </div>

      <AiInsight className="mt-6" ask="Which customers should we follow up with first?">
        {old.total === 0 ? (
          <>{t(open.length ? 'Nothing has been pending for more than 6 months.' : 'No customer balances are loaded yet.')}</>
        ) : (
          <>
            <strong className="font-semibold">{formatINRShort(old.total)}</strong> {t('has been pending for over 6 months')}
            {old.share >= 0.5 && <>, {t('mostly from')} {old.top.length} {old.govt ? t('government departments') : t('customers')}</>}.
            <span className="mt-1 block text-[13px] text-muted-foreground">{t('Largest')}: {old.top.map((c) => `${c.name} (${formatINRShort(c.amount)})`).join(' · ')}</span>
          </>
        )}
      </AiInsight>

      <div className="mt-10 space-y-10">
        <section>
          <SectionHead title="How old is the money owed?" term="Ageing of receivables · tap a bar to filter the list" />
          <AgeingChart rows={rows} bucket={bucket} onBucket={setBucket} />
        </section>
        <CustomerList recs={open} divisions={divisions} today={TODAY} bucket={bucket} onClear={() => setBucket(null)} />
        <PaymentMatching />
        <BankReconciliation />
      </div>
    </div>
  )
}
