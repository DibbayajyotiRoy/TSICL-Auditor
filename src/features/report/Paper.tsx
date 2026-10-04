// The printed document. Always white, even in dark mode (see PAPER_CSS in ReportPage for its colour tokens).
import type { ReactNode } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { SeverityBadge } from '@/components/kit'
import { Markdown } from '@/components/ui/markdown'
import { TODAY } from '@/data/store'
import { AREA_LABEL, SEVERITY_LABEL, type FindingStatus, type Severity } from '@/data/types'
import { cn, formatDate, formatINR, formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { plural, type Stats } from './summary'

export const DRAFT_LABEL = 'AI-generated draft — pending auditor review'
const STATUS: Record<FindingStatus, string> = { open: 'Awaiting auditor', confirmed: 'Confirmed', rejected: 'Rejected', investigating: 'Under investigation' }
const SEV_TEXT: Record<Severity, string> = { critical: 'text-sev-critical', high: 'text-sev-high', medium: 'text-sev-medium', low: 'text-sev-low' }
const KEY_ROWS = 12

/** FY 2024-25 ✓ · FY 2025-26 ✓ · FY 2026-27 in progress */
export function FyCoverage({ className }: { className?: string }) {
  const t = useT()
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground', className)}>
      {['FY 2024-25', 'FY 2025-26'].map((fy) => (
        <span key={fy} className="inline-flex items-center gap-1"><Check className="size-3.5 text-sev-ok" aria-hidden />{fy}</span>
      ))}
      <span className="inline-flex items-center gap-1.5">FY 2026-27 <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">{t('in progress')}</span></span>
    </p>
  )
}

function Section({ n, title, className, children }: { n: number; title: string; className?: string; children: ReactNode }) {
  const t = useT()
  return (
    <section className={cn('mt-12', className)}>
      <h2 className="flex items-baseline gap-2 border-b border-border pb-2 text-[16px] font-semibold tracking-tight text-foreground">
        <span className="tabular-nums text-muted-foreground">{n}.</span>{t(title)}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  const t = useT()
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-[12px] text-muted-foreground">{t(label)}</div>
      <div className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {note && <div className="mt-1.5 text-[12px] text-muted-foreground">{t(note)}</div>}
    </div>
  )
}

function SignBlock({ role, org, signedOn }: { role: string; org: string; signedOn?: string }) {
  const t = useT()
  return (
    <div>
      <div className="flex h-16 items-end border-b border-foreground/60 pb-1.5">
        {signedOn && <span className="inline-flex items-center gap-1.5 text-[15px] italic text-foreground"><Check className="size-4 text-sev-ok" aria-hidden />{t('Digitally approved')}</span>}
      </div>
      <div className="mt-2 text-[13px] font-semibold">{t(role)}</div>
      <div className="text-[12px] text-muted-foreground">{org}</div>
      <div className="mt-3 text-[12px] text-muted-foreground">{t('Date')}: {signedOn ? <span className="text-foreground">{formatDate(signedOn)}</span> : '____ / ____ / ________'}</div>
    </div>
  )
}

export function Paper({ stats: s, summary, approvedAt }: { stats: Stats; summary: string; approvedAt?: string }) {
  const t = useT()
  const c = s.cov
  const max = Math.max(1, ...s.ranked.map((a) => a.count))
  const d = s.decisions
  const dTotal = d.confirmed + d.rejected + d.pending
  const covRows: [string, string, string, string][] = [
    [t('Documents received and read'), plural(c.documents, 'document'), '100%', `${plural(c.pages, 'page')} ${t('read by AI;')} ${c.needsReview} ${t('flagged for manual review')}`],
    [t('Purchase orders'), plural(c.pos, 'record'), '100%', t('Approval limits, split orders, quotations, GRN and payment match')],
    [t('Money Owed to Us'), plural(c.receivables, 'invoice'), '100%', t('Ageing, overdue customers, long-unpaid balances')],
    [t('Bank receipts'), plural(c.receipts, 'receipt'), '100%', `${c.matched} ${t('matched to invoices,')} ${c.receipts - c.matched} ${t('unmatched')}`],
    [t('Assets and equipment'), plural(c.assets, 'asset'), `${c.verified} ${t('of')} ${c.assets}`, `${t('Physical verification sample:')} ${c.assets ? Math.round((c.verified / c.assets) * 100) : 0}% ${t('of the register')}`],
  ]

  return (
    <article className="report-paper relative mx-auto w-full max-w-[794px] rounded-sm border border-border px-5 py-8 text-[13px] leading-relaxed sm:px-12 sm:py-12">
      {!approvedAt && (
        <div className="report-watermark" aria-hidden>
          <div><span className="text-[64px] leading-none tracking-[0.12em] sm:text-[96px]">{t('DRAFT')}</span><span className="mt-2 text-[12px] uppercase tracking-[0.14em] sm:text-[14px]">{t(DRAFT_LABEL)}</span></div>
        </div>
      )}

      {/* Cover */}
      <header className="report-cover flex min-h-[480px] flex-col justify-between sm:min-h-[560px]">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-foreground text-[13px] font-semibold text-background">TS</div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Tripura Small Industries Corporation Ltd.</div>
            <div className="text-[12px] text-muted-foreground">{t('TSICL · Government of Tripura undertaking')}</div>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{t('Confidential · For the Board of Directors')}</p>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-tight sm:text-[44px]">
            {t('Internal Audit Report')}<span className="sr-only"> — </span>
            <span className="mt-3 block text-[18px] font-normal tracking-normal text-foreground/70 sm:text-[22px]">{t('Quarter 2 (July–September 2026)')}</span>
          </h1>
          <p className="mt-6 text-[13px] text-muted-foreground">{t('Financial Year 2026-27 · Submitted to the Board through the Managing Director')}</p>
          <div className={cn('mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-inset', approvedAt ? 'bg-sev-ok/10 text-sev-ok ring-sev-ok/25' : 'bg-sev-medium/10 text-sev-medium ring-sev-medium/30')}>
            {approvedAt ? <><Check className="size-3.5" aria-hidden />{t('Approved by auditor on')} {formatDate(approvedAt)}</> : t(DRAFT_LABEL)}
          </div>
        </div>
        <div>
          <div className="border-t border-foreground/80 pt-4 text-[13px]">{t('Prepared with AI assistance. Reviewed and signed by the appointed Internal Auditor.')}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">{t('Report date')}: {formatDate(TODAY)}</div>
        </div>
      </header>

      <div className="rp-break">
        <Section n={1} title="Executive summary">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-ai/10 px-2.5 py-1 text-[11px] font-medium text-ai">
            <Sparkles className="size-3" aria-hidden />{approvedAt ? t('AI drafted · Reviewed by auditor') : t('AI drafted · Auditor to review')}
          </div>
          <Markdown className="text-[13.5px] leading-[1.7] text-foreground/90 [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-foreground">{summary}</Markdown>
        </Section>

        <Section n={2} title="Findings at a glance" className="rp-avoid">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((k) => (
              <div key={k} className="rounded-xl border border-border p-4">
                <div className={cn('text-[12px] font-medium capitalize', SEV_TEXT[k])}>{k}</div>
                <div className="mt-1 text-[36px] font-semibold leading-none tracking-tight tabular-nums">{s.sev[k]}</div>
                <div className="mt-1.5 text-[12px] text-muted-foreground">{t(SEVERITY_LABEL[k])}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            {plural(s.reported, 'reported finding')} {t('with a potential financial exposure of')} <strong className="font-semibold text-foreground">{formatINR(s.amount)}</strong>.
            {s.dismissed > 0 && <> {s.dismissed} {t('dismissed by the auditor are excluded.')}</>}
          </p>
          <h3 className="mb-3 mt-7 text-[13px] font-semibold">{t('Findings by area')}</h3>
          {s.ranked.length === 0 ? <p className="text-muted-foreground">{t('No findings to report.')}</p> : (
            <ul className="space-y-3.5">
              {s.ranked.map((a) => (
                <li key={a.area} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5" title={`${a.label}: ${plural(a.count, 'finding')}, ${formatINR(a.amount)}`}>
                  <span>{a.label}</span>
                  <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{a.count}</span> · {formatINRShort(a.amount)}</span>
                  <div className="col-span-2 h-2 rounded-[4px] bg-muted"><div className="h-full rounded-[4px] bg-foreground/80" style={{ width: `${(a.count / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section n={3} title="Key findings" className="rp-break">
        {s.key.length === 0 ? <p className="text-muted-foreground">{t('No critical or high findings this quarter.')}</p> : (
          <>
            <table className="block w-full border-collapse text-[12px] sm:table">
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  {['No.', 'Area', 'Observation', 'Amount', 'Status', 'Evidence'].map((h) => <th key={h} className={cn('py-2 pr-3 font-medium', h === 'Amount' && 'text-right')}>{t(h)}</th>)}
                </tr>
              </thead>
              <tbody className="block sm:table-row-group">
                {s.key.slice(0, KEY_ROWS).map((f) => {
                  const cell = 'block py-0.5 align-top before:block before:text-[11px] before:text-muted-foreground before:content-[attr(data-label)] sm:table-cell sm:py-3 sm:pr-3 sm:before:hidden'
                  return (
                    <tr key={f.id} className="rp-avoid block border-b border-border py-3 sm:table-row sm:py-0">
                      <td data-label="No." className={cell}><div className="font-mono font-medium">{f.id}</div><SeverityBadge severity={f.severity} className="mt-1" /></td>
                      <td data-label="Area" className={cell}>{t(AREA_LABEL[f.area])}</td>
                      <td data-label="Observation" className={cell}><div className="font-medium">{f.title}</div><div className="mt-0.5 text-muted-foreground">{f.reason}</div></td>
                      <td data-label="Amount" className={cn(cell, 'whitespace-nowrap tabular-nums sm:text-right')}>{f.amount ? formatINR(f.amount) : '—'}</td>
                      <td data-label="Status" className={cell}>{t(STATUS[f.status])}</td>
                      <td data-label="Evidence" className={cn(cell, 'font-mono text-[11px] text-muted-foreground')}>
                        {f.evidence.slice(0, 3).map((e) => e.label).join(', ')}{f.evidence.length > 3 && ` +${f.evidence.length - 3}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {s.key.length > KEY_ROWS && <p className="mt-3 text-[12px] text-muted-foreground">{t('Top')} {KEY_ROWS} {t('of')} {s.key.length} {t('critical and high findings, ranked by severity and amount. The full list is in the Findings register.')}</p>}
          </>
        )}
      </Section>

      <div className="rp-break">
        <Section n={4} title="Area-wise observations">
          <div className="space-y-4">
            {s.ranked.map((a) => (
              <p key={a.area}>
                <strong className="font-semibold">{t(a.label)}.</strong> {plural(a.count, 'finding')}
                {a.critical + a.high > 0 && <> ({a.critical} {t('critical')}, {a.high} {t('high')})</>}, {t('with')} {formatINRShort(a.amount)} {t('at risk.')}
                {a.top && <> {t('The most significant is')} “{a.top.title}”{a.top.amount ? ` (${formatINR(a.top.amount)})` : ''}.</>}
                {' '}{a.confirmed} {t('confirmed by the auditor,')} {a.pending} {t('awaiting decision.')}
              </p>
            ))}
            {s.quiet.length > 0 && <p className="text-muted-foreground">{t('No exceptions were noted in')} {s.quiet.map((a) => t(a.label)).join(', ')}.</p>}
            {s.ranked.length === 0 && s.quiet.length === 0 && <p className="text-muted-foreground">{t('No area-wise observations to report.')}</p>}
          </div>
        </Section>

        <Section n={5} title="Status of auditor decisions" className="rp-avoid">
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('Confirmed')} value={d.confirmed} note={t('Valid, to be reported')} />
            <Stat label={t('Rejected')} value={d.rejected} note={t('Dismissed as not valid')} />
            <Stat label={t('pending')} value={d.pending} note={`${d.investigating} ${t('under investigation')}`} />
          </div>
          {dTotal > 0 && (
            <div className="mt-4 flex h-2 gap-0.5" role="img" aria-label={`${d.confirmed} confirmed, ${d.rejected} rejected, ${d.pending} pending`}>
              {[{ n: d.confirmed, cls: 'bg-foreground' }, { n: d.rejected, cls: 'bg-foreground/40' }, { n: d.pending, cls: 'bg-foreground/15' }].map(({ n, cls }) => (
                n > 0 && <div key={cls} className={cn('rounded-[4px]', cls)} style={{ flex: n }} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="rp-break">
        <Section n={6} title="Coverage">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('Documents examined')} value={c.documents.toLocaleString('en-IN')} />
            <Stat label={t('Checks run')} value={`${c.checksOn}`} note={`${t('of')} ${c.checksTotal} ${t('available')}`} />
            <Stat label={t('Divisions covered')} value={c.divisions} />
            <Stat label={t('Open document requests')} value={c.openRequests} />
          </div>
          <FyCoverage className="mt-4" />
          <table className="mt-5 block w-full border-collapse text-[12px] sm:table">
            <thead className="hidden sm:table-header-group">
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                {['Records', 'In scope', 'Examined', 'Method'].map((h) => <th key={h} className="py-2 pr-3 font-medium">{t(h)}</th>)}
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {covRows.map(([a, b, e, m]) => (
                <tr key={a} className="rp-avoid block border-b border-border py-2.5 sm:table-row sm:py-0">
                  <td className="block font-medium sm:table-cell sm:py-2.5 sm:pr-3">{a}</td>
                  <td className="block tabular-nums sm:table-cell sm:py-2.5 sm:pr-3">{b}</td>
                  <td className="block tabular-nums sm:table-cell sm:py-2.5 sm:pr-3">{e}</td>
                  <td className="block text-muted-foreground sm:table-cell sm:py-2.5">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n={7} title="Sign-off" className="rp-avoid">
          <div className="grid gap-10 sm:grid-cols-2">
            <SignBlock role="Internal Auditor" org="Chartered Accountants, appointed Internal Auditor" signedOn={approvedAt} />
            <SignBlock role="Managing Director" org="Tripura Small Industries Corporation Ltd." />
          </div>
          <p className="mt-6 text-[12px] text-muted-foreground">
            {approvedAt ? <>{t('Approved by auditor on')} {formatDate(approvedAt)}.</> : <>{t(DRAFT_LABEL)}. {t('This report becomes final when the Internal Auditor approves and signs it.')}</>}
          </p>
        </Section>

        <footer className="mt-12 border-t border-border pt-4 text-center text-[12px] italic text-muted-foreground">
          {t('The appointed auditor remains responsible for the audit opinion. This system automates the repetitive work around them.')}
        </footer>
      </div>
    </article>
  )
}
