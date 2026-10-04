import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { ArrowLeftRight, Check, FileText, ListChecks, Mail, PenLine, Printer, RefreshCw, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/kit'
import { BlurFade } from '@/components/ui/blur-fade'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DotLoader } from '@/components/ui/dot-loader'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAudit } from '@/data/store'
import { play } from '@/lib/sound'
import { cn, formatDate, formatINRShort } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { DRAFT_LABEL, FyCoverage, Paper } from './Paper'
import { useReport } from './store'
import { buildStats, plural, type Stats } from './summary'

// Paper keeps light-mode tokens in dark mode. Print: hide every sibling of the paper's ancestors (:has), flatten the
// ancestors, and let the browser paginate normally. The watermark is position:fixed in print so it repeats on each page.
const CSS = `
.report-paper{--background:#fff;--foreground:oklch(.18 0 0);--card:#fff;--popover:#fff;--popover-foreground:oklch(.18 0 0);--muted:oklch(.968 0 0);--muted-foreground:oklch(.48 0 0);--border:oklch(.9 0 0);--sev-critical:oklch(.52 .21 25);--sev-high:oklch(.56 .17 48);--sev-medium:oklch(.52 .12 80);--sev-low:oklch(.5 .12 245);--sev-ok:oklch(.5 .14 155);--ai:oklch(.5 .2 285);color-scheme:light;background:#fff;color:var(--foreground);box-shadow:0 1px 2px rgb(0 0 0/.06),0 18px 50px -18px rgb(0 0 0/.3)}
.report-watermark{position:absolute;inset:0;overflow:clip;pointer-events:none;z-index:20}
.report-watermark>div{position:sticky;top:40vh;margin-top:40vh;display:flex;flex-direction:column;align-items:center;transform:rotate(-24deg);color:oklch(.55 .2 25/.11);font-weight:700;text-align:center}
@page{size:A4;margin:14mm 12mm}
@media print{
html,body{background:#fff!important}
*:has(.report-paper){display:block!important;position:static!important;overflow:visible!important;height:auto!important;min-height:0!important;max-height:none!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;transform:none!important;filter:none!important;box-shadow:none!important}
*:has(.report-paper)>:not(:has(.report-paper)):not(.report-paper){display:none!important}
.report-paper{width:100%!important;border:0!important;border-radius:0!important;padding:0!important;box-shadow:none!important}
.report-paper,.report-paper *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report-cover{min-height:258mm!important;break-after:page}
.rp-break{break-before:page}
.rp-break>section:first-child{margin-top:0!important}
.rp-avoid,tr{break-inside:avoid}
h2,h3{break-after:avoid}
.report-watermark{position:fixed;inset:0;display:grid;place-items:center}
.report-watermark>div{position:static;margin:0}
}`

const FRAMES = [0, 1, 2, 3, 2, 1].map((k) => Array.from({ length: 49 }, (_, i) => i).filter((i) => Math.max(Math.abs(Math.floor(i / 7) - 3), Math.abs((i % 7) - 3)) === k))

function useStats() {
  const f = useAudit((s) => s.findings), d = useAudit((s) => s.documents), r = useAudit((s) => s.rules), po = useAudit((s) => s.purchaseOrders)
  const rc = useAudit((s) => s.receivables), b = useAudit((s) => s.bankReceipts), a = useAudit((s) => s.assets), dv = useAudit((s) => s.divisions), rq = useAudit((s) => s.requests)
  return useMemo(() => buildStats({ findings: f, documents: d, rules: r, purchaseOrders: po, receivables: rc, bankReceipts: b, assets: a, divisions: dv, requests: rq }), [f, d, r, po, rc, b, a, dv, rq])
}

function printReport() {
  const prev = document.title
  document.title = 'TSICL Internal Audit Report Q2 FY2026-27'
  window.addEventListener('afterprint', () => { document.title = prev }, { once: true })
  window.print()
}

const DraftPill = () => {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sev-medium/10 px-3 py-1 text-[12px] font-medium text-sev-medium ring-1 ring-inset ring-sev-medium/30">
      <Sparkles className="size-3.5" aria-hidden />{t(DRAFT_LABEL)}
    </span>
  )
}

function Hero({ s, onGenerate }: { s: Stats; onGenerate: () => Promise<void> }) {
  const t = useT()
  const nav = useNavigate()
  const c = s.cov
  const contents: [string, string][] = [
    [t('Executive summary'), t('About 150 words, written by AI for the Board')],
    [t('Findings at a glance'), `${plural(s.reported, 'finding')} ${t('by severity and area')}`],
    [t('Key findings'), t('Critical and high items with evidence references')],
    [t('Area-wise observations'), `${plural(s.ranked.length, 'area')} ${t('with findings')}`],
    [t('Auditor decisions'), `${s.decisions.confirmed} ${t('confirmed')} · ${s.decisions.rejected} ${t('rejected')} · ${s.decisions.pending} ${t('pending')}`],
    [t('Coverage'), `${plural(c.documents, 'document')} · ${plural(c.checksOn, 'check')}`],
    [t('Sign-off'), t('Signature lines for the Auditor and the Managing Director')],
  ]
  return (
    <BlurFade>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('Internal Audit Report · Q2 FY 2026-27')}</p>
            <DraftPill />
          </div>
          <h2 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">Tripura Small Industries Corporation Ltd.</h2>
          <p className="mt-1 text-[15px] text-muted-foreground">{t('Quarter 2 (July–September 2026) · For the Board, through the Managing Director')}</p>
          <p className="mt-4 text-[14px] text-muted-foreground">{t('Prepared by: [Appointed Internal Auditor]')}</p>
          <FyCoverage className="mt-3" />
        </div>

        <div className="grid gap-px border-y border-border bg-border md:grid-cols-2">
          <div className="bg-card p-6 sm:p-8">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold"><Sparkles className="size-4 text-ai" aria-hidden />{t('AI-assisted analysis')}</h3>
            <dl className="mt-4 space-y-3 text-[14px]">
              {[[FileText, t('Documents read'), c.documents], [ArrowLeftRight, t('Transactions examined'), c.transactions], [ListChecks, t('Audit checks run'), c.checksOn]].map(([Icon, label, n]) => {
                const I = Icon as typeof FileText
                return (
                  <div key={label as string} className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2.5 text-muted-foreground"><I className="size-4" aria-hidden />{label as string}</dt>
                    <dd className="font-semibold tabular-nums">{(n as number).toLocaleString('en-IN')}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
          <div className="bg-card p-6 sm:p-8">
            <h3 className="text-[13px] font-semibold">{t('Executive summary preview')}</h3>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {([['critical', t('Critical')], ['high', t('High')], ['medium', t('Medium')]] as const).map(([k, l]) => (
                <div key={k}>
                  <div className={cn('text-[30px] font-semibold leading-none tracking-tight tabular-nums', { critical: 'text-sev-critical', high: 'text-sev-high', medium: 'text-sev-medium' }[k])}>{s.sev[k]}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[14px]"><span className="text-muted-foreground">{t('Potential financial exposure')} </span><span className="font-semibold tabular-nums">{formatINRShort(s.amount)}</span></p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h3 className="text-[13px] font-semibold">{t('What goes into the report')}</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {contents.map(([t, d]) => (
              <li key={t} className="flex items-start gap-2.5 text-[14px]">
                <Check className="mt-0.5 size-4 shrink-0 text-sev-ok" aria-hidden />
                <span><span className="font-medium">{t}</span><span className="text-muted-foreground"> · {d}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/30 p-6 sm:px-8">
          <Button variant="outline" className="h-11 gap-2 px-4" onClick={() => nav('/findings')}><ListChecks aria-hidden />{t('Review findings')}</Button>
          <Button data-tour="report-generate" className="h-11 gap-2 px-5 text-[15px]" onClick={onGenerate}><Sparkles aria-hidden />{t('Generate report')}</Button>
          <Button variant="outline" className="h-11 gap-2 px-4" onClick={() => onGenerate().then(() => setTimeout(printReport, 900))}><Printer aria-hidden />{t('Print / PDF')}</Button>
          <p className="text-[13px] text-muted-foreground sm:ml-auto">{t('Takes about 3 seconds. Nothing is final until the auditor signs.')}</p>
        </div>
      </section>
    </BlurFade>
  )
}

function Generating({ raised }: { raised: number }) {
  const t = useT()
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    const ids = [1, 2].map((i) => setTimeout(() => setStep(i), i * 1000))
    return () => ids.forEach(clearTimeout)
  }, [])
  const steps = [`${t('Collecting')} ${plural(raised, 'finding')}…`, t('Writing executive summary…'), t('Building charts and tables…')]
  return (
    <section role="status" aria-live="polite" className="grid min-h-[380px] place-items-center rounded-2xl border border-border bg-card p-8">
      <div className="flex flex-col items-center">
        <DotLoader frames={FRAMES} duration={140} isPlaying={!reduce} className="gap-1" dotClassName="size-2 bg-muted-foreground/15 transition-colors duration-150 [&.active]:bg-ai" />
        <ol className="mt-8 space-y-3">
          {steps.map((t, i) => (
            <li key={t} className={cn('flex items-center gap-2.5 text-[15px] transition-colors', i < step ? 'text-muted-foreground' : i === step ? 'font-medium text-foreground' : 'text-muted-foreground/50')}>
              {i < step ? <Check className="size-4 text-sev-ok" aria-hidden /> : <span className="grid size-4 place-items-center"><span className="size-1.5 rounded-full bg-current" /></span>}
              {t}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const BOARD = [
  ['Managing Director', 'md@tsicl.example'],
  ['Chairman, Board of Directors', 'chairman@tsicl.example'],
  ['Company Secretary', 'secretary@tsicl.example'],
  ['Director (Finance)', 'finance.director@tsicl.example'],
] as const

function EmailDialog({ open, onOpenChange, approved }: { open: boolean; onOpenChange: (v: boolean) => void; approved: boolean }) {
  const t = useT()
  const [to, setTo] = useState<string[]>([BOARD[0][1], BOARD[1][1], BOARD[2][1]])
  const [sending, setSending] = useState(false)
  const send = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      onOpenChange(false)
      toast.success(`${t('Report emailed to')} ${plural(to.length, 'recipient')}`, { description: approved ? t('Sent as the signed final report.') : t('Sent as a draft — still pending auditor review.') })
      useAudit.getState().log('report', `Q2 report emailed to the Board (${to.length} recipients)`)
      play('success')
    }, 900)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Email to Board')}</DialogTitle>
          <DialogDescription>{t('Sends the report as a PDF. This is a demo, so nothing is actually emailed.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!approved && <p className="rounded-lg bg-sev-medium/10 px-3 py-2 text-[13px] text-sev-medium">{t(DRAFT_LABEL)}. {t('Approve and sign first, or send as a draft.')}</p>}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-[13px] font-medium">{t('To')}</legend>
            {BOARD.map(([name, mail]) => (
              <Label key={mail} className="min-h-10 cursor-pointer gap-3 rounded-lg px-2 font-normal hover:bg-muted">
                <Checkbox checked={to.includes(mail)} onCheckedChange={(v) => setTo((t) => (v ? [...t, mail] : t.filter((m) => m !== mail)))} />
                <span className="flex min-w-0 flex-col gap-1"><span>{name}</span><span className="truncate text-xs text-muted-foreground">{mail}</span></span>
              </Label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="rp-msg">{t('Message')}</Label>
            <Textarea id="rp-msg" defaultValue={'Respected Sir,\n\nPlease find enclosed the Internal Audit Report for Quarter 2 (July–September 2026).\n\nRegards,\nInternal Audit'} />
          </div>
          <p className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs text-muted-foreground"><FileText className="size-3.5" aria-hidden />TSICL-Internal-Audit-Report-Q2-FY2026-27.pdf</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-10" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button className="h-10 gap-2" disabled={!to.length || sending} onClick={send}><Mail aria-hidden />{sending ? t('Sending…') : t('Send to Board')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ReportPage() {
  const t = useT()
  const { phase, summary, approvedAt, generate, approve } = useReport()
  const stats = useStats()
  const [emailOpen, setEmailOpen] = useState(false)

  return (
    <div>
      <div data-shell><PageHeader title="Quarterly Report" subtitle="The Board-ready deliverable. AI drafts it; the appointed auditor reviews and signs." /></div>

      {phase === 'idle' && <Hero s={stats} onGenerate={generate} />}
      {phase === 'working' && <Generating raised={stats.raised} />}
      {phase === 'ready' && (
        <>
          <style>{CSS}</style>
          <div data-shell className="sticky top-2 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/85 p-2.5 pl-4 shadow-[0_8px_30px_-16px_rgb(0_0_0/0.25)] backdrop-blur">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {approvedAt ? <><Check className="size-4 text-sev-ok" aria-hidden />{t('Approved by auditor on')} {formatDate(approvedAt)}</> : <><span className="size-2 rounded-full bg-sev-medium" aria-hidden />{t(DRAFT_LABEL)}</>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" className="h-10 gap-2" data-tour="report-generate" title={t("Regenerating clears the auditor's approval")} onClick={generate}><RefreshCw aria-hidden />{t('Regenerate')}</Button>
              <Button variant="outline" className="h-10 gap-2" onClick={printReport}><Printer aria-hidden /><span className="hidden sm:inline">{t('Print / Save as PDF')}</span><span className="sm:hidden">{t('Print')}</span></Button>
              <Button variant={approvedAt ? 'default' : 'outline'} className="h-10 gap-2" onClick={() => setEmailOpen(true)}><Mail aria-hidden />{t('Email to Board')}</Button>
              {!approvedAt && <Button className="h-10 gap-2" onClick={approve}><PenLine aria-hidden />{t('Approve & sign')}</Button>}
            </div>
          </div>
          <BlurFade><Paper stats={stats} summary={summary} approvedAt={approvedAt} /></BlurFade>
          <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} approved={!!approvedAt} />
        </>
      )}
    </div>
  )
}
