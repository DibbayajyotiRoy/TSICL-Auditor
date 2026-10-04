import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Boxes, CalendarClock, Check, HandCoins, Landmark, Lock, Send, ShoppingCart, Sparkles, Upload } from 'lucide-react'
import { useAudit } from '@/data/store'
import type { DocRequest } from '@/data/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DotLoader } from '@/components/ui/dot-loader'
import { Textarea } from '@/components/ui/textarea'
import { ask } from '@/lib/ai'
import { useT } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { cn, formatDate } from '@/lib/utils'
import { sleep } from './FastForward'
import { addDays, simToday, useClock } from './lib'

const QUARTER = 'Q2 FY 2026-27'
const AREAS = [
  { id: 'purchases', label: 'Purchases', hint: 'Orders, invoices and quotations', icon: ShoppingCart, subject: 'Procurement', docs: [
    'Purchase orders issued in July to September 2026, with approval notes',
    'Vendor invoices and goods-received notes for each order',
    'Comparative quotations (three or more, where required)',
    'Payment vouchers with bank payment advice',
    'Note showing who sanctioned each order and under which financial power',
  ] },
  { id: 'owed', label: 'Money Owed', hint: 'Customer dues and payments received', icon: HandCoins, subject: 'Receivables', docs: [
    'Customer-wise outstanding statement as on 30 September 2026',
    'Invoices raised during the quarter',
    'Receipts and bank credits against those invoices',
    'Reminders and letters sent to customers with overdue amounts',
    'List of disputed or written-off balances, with approvals',
  ] },
  { id: 'assets', label: 'Assets', hint: 'Equipment, vehicles and buildings', icon: Boxes, subject: 'Fixed Assets', docs: [
    'Fixed asset register as on 30 September 2026',
    'Purchase bills for assets added this quarter',
    'Latest physical verification report',
    'Approvals for any transfer, disposal or write-off',
    'Insurance details for vehicles and buildings',
  ] },
  { id: 'cash', label: 'Cash & Bank', hint: 'Bank statements and cash book', icon: Landmark, subject: 'Cash & Bank', docs: [
    'Bank statements for every account, July to September 2026',
    'Cash book and bank book for the quarter',
    'Bank reconciliation statements as on 30 September 2026',
    'Cheque issue register and cancelled cheques',
    'Petty cash vouchers',
  ] },
]

const SYSTEM = "You draft emails for the Internal Audit team of an Indian state government corporation. Tone: polite, respectful, formal Indian government-office English (for example 'kindly' and 'at your earliest convenience'). Plain words, no jargon, no markdown. Reply with only the requested text."

// Deterministic fallback: ask() returns null in demo mode or on any failure, so the demo never breaks.
const template = (unit: string, area: string) =>
  `The Internal Audit team is carrying out the quarterly review of ${area.toLowerCase()} records for ${QUARTER} (July to September 2026). To complete the review for ${unit}, we kindly request you to share the documents listed below at your earliest convenience.`

/** Keep only the opening paragraph: drop any greeting, sign-off or subject line the model added anyway. */
const clean = (t: unknown) => {
  const paras = String(t ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^(dear|respected|subject|regards|yours|sincerely|thanks|with regards)/i.test(p))
  const out = paras.slice(0, 2).join('\n\n')
  return out.length > 20 && out.length < 900 ? out : null
}

// Diagonal sweep across the 7x7 dot grid.
const FRAMES = Array.from({ length: 13 }, (_, t) => Array.from({ length: 49 }, (_, i) => i).filter((i) => Math.floor(i / 7) + (i % 7) === t))

const STEP_TEXT = [
  ['Which department?', 'Pick the unit that should receive this request.'],
  ['What do you need papers for?', 'The assistant will list the usual documents for this area.'],
  ['Review the email', 'The assistant drafted this. Edit the opening paragraph if you like. Nothing goes out until you approve.'],
]

function Wizard({ onClose, onSent }: { onClose: () => void; onSent: (id: string) => void }) {
  const t = useT()
  const divisions = useAudit((s) => s.divisions)
  const [step, setStep] = useState(1)
  const [divId, setDivId] = useState<string>()
  const [areaId, setAreaId] = useState<string>()
  const [intro, setIntro] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [byAi, setByAi] = useState(false)
  const [sentTo, setSentTo] = useState<string>()
  const [link] = useState(() => `audit.tsicl.ai/u/${Math.random().toString(36).slice(2, 8)}`)
  const division = divisions.find((d) => d.id === divId)
  const area = AREAS.find((a) => a.id === areaId)
  const subject = area ? `Internal Audit — ${area.subject} Documents Required — ${QUARTER}` : ''
  const offset = useClock((s) => s.offset)
  const today = simToday(offset)
  const deadline = addDays(today, 7)

  // draft the opening paragraph when the review step opens
  useEffect(() => {
    if (step !== 3 || !division || !area) return
    let stale = false
    setDrafting(true)
    const draft = async () => {
      const text = await ask(SYSTEM, [{ role: 'user', content: `Write the opening paragraph (2 to 3 sentences, at most 70 words) of an email from the Internal Audit team of Tripura Small Industries Corporation Ltd to the officer of ${division.name}, ${division.location}. Purpose: request the ${area.subject} documents for the ${QUARTER} quarterly internal audit (July to September 2026). No greeting, no subject, no document list, no deadline, no sign-off.` }])
      return clean(text)
    }
    // ponytail: min 600ms so the "drafting" moment is visible even when the fallback answers at once.
    Promise.all([draft(), sleep(600)]).then(([text]) => {
      if (stale) return
      setIntro(text ?? template(division.name, area.label))
      setByAi(!!text)
      setDrafting(false)
    })
    return () => { stale = true }
  }, [step, division, area])

  const send = () => {
    if (!division || !area) return
    const id = `REQ-${Date.now().toString(36).toUpperCase()}`
    const req: DocRequest = {
      id, divisionId: division.id, subject, items: area.docs.map((label) => ({ label, received: false })),
      sentAt: today, deadline, stage: 'sent',
      timeline: [{ at: `${today}T${new Date().toISOString().slice(11)}`, event: `Drafted by the assistant, approved by the auditor and emailed to ${division.officer} with a secure upload link` }],
    }
    useAudit.setState((s) => ({ requests: [req, ...s.requests] }))
    useAudit.getState().log('reminder', `Auditor approved and sent a request for ${area.subject} papers to ${division.name}, due ${formatDate(deadline)}`)
    play('confirm')
    onSent(id)
    setSentTo(division.name)
  }

  if (sentTo) return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="grid size-16 place-items-center rounded-full bg-sev-ok/10 text-sev-ok ring-1 ring-sev-ok/25">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} />
        </svg>
      </motion.span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-balance">{t('Request sent to')} {sentTo}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{t('The assistant will remind them if there is no reply, and will only recommend escalation for you to approve.')}</p>
      <p className="mt-2 text-xs text-muted-foreground">{t('Demo mailbox — no real email was sent.')}</p>
      <Button className="mt-6 h-10 px-5" onClick={onClose}>{t('Done')}</Button>
    </div>
  )

  const ready = step === 1 ? !!division : step === 2 ? !!area : !drafting && intro.trim().length > 0
  const [title, desc] = STEP_TEXT[step - 1]
  return (
    <>
      <div className="px-5 pt-5 pr-12">
        <div className="flex items-center gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => <span key={n} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', n <= step ? 'bg-foreground' : 'bg-muted')} />)}
        </div>
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">{t('Step')} {step} {t('of')} 3</p>
        <DialogTitle className="mt-1 text-lg leading-snug font-semibold tracking-tight text-balance">{t(title)}</DialogTitle>
        <DialogDescription className="mt-1 text-pretty">{t(desc)}</DialogDescription>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
            {step === 1 && (
              <div role="group" aria-label="Departments" className="grid gap-2 sm:grid-cols-2">
                {divisions.length === 0 && <p className="text-sm text-muted-foreground">{t('No departments are set up yet.')}</p>}
                {divisions.map((d) => (
                  <Option key={d.id} on={d.id === divId} onClick={() => { play('tap'); setDivId(d.id) }}>
                    <span className="block text-sm font-medium">{d.name}</span>
                    <span className="block text-[13px] text-muted-foreground">{d.location} · {d.officer}</span>
                  </Option>
                ))}
              </div>
            )}
            {step === 2 && (
              <div role="group" aria-label="Audit areas" className="grid gap-2 sm:grid-cols-2">
                {AREAS.map((a) => (
                  <Option key={a.id} on={a.id === areaId} onClick={() => { play('tap'); setAreaId(a.id) }}>
                    <span className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground"><a.icon className="size-4.5" aria-hidden /></span>
                      <span>
                        <span className="block text-sm font-medium">{t(a.label)}</span>
                        <span className="block text-[13px] text-muted-foreground">{t(a.hint)}</span>
                      </span>
                    </span>
                  </Option>
                ))}
              </div>
            )}
            {step === 3 && division && area && (drafting ? (
              <div className="grid min-h-72 place-items-center" role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-4">
                  <DotLoader frames={FRAMES} duration={70} dotClassName="size-2 bg-muted-foreground/20 transition-colors duration-100 [&.active]:bg-ai" />
                  <p className="text-sm text-muted-foreground">{t('Drafting the email to')} {division.officer}…</p>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {byAi ? <><Sparkles className="size-3.5 text-ai" aria-hidden /><span className="text-ai">{t('Drafted by AI')}</span> · {t('you approve before it is sent')}</> : <>{t('Drafted from the standard template')} · {t('you approve before it is sent')}</>}
                </p>
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="border-b border-border bg-muted/40 px-4 py-3 text-[13px]">
                  <p className="pb-2 text-xs text-muted-foreground">{t('Demo mailbox — no real emails are sent.')}</p>
                  <dl className="space-y-1.5">
                    {[['From', 'Internal Audit, TSICL <audit@tsicl.ai>'], ['To', `${division.officer} <${division.email}>`], ['Subject', subject]].map(([k, v]) => (
                      <div key={k} className="flex gap-3"><dt className="w-14 shrink-0 text-muted-foreground">{t(k)}</dt><dd className={cn('min-w-0 break-words', k === 'Subject' && 'font-medium')}>{v}</dd></div>
                    ))}
                  </dl>
                  </div>
                  <div className="space-y-4 px-5 py-5 text-sm leading-relaxed">
                    <p>{t('Respected')} {division.officer},</p>
                    <Textarea aria-label="Opening paragraph" value={intro} onChange={(e) => setIntro(e.target.value)}
                      className="-mx-2 min-h-0 w-[calc(100%+1rem)] resize-none border-transparent bg-transparent px-2 py-1 leading-relaxed hover:border-border dark:bg-transparent" />
                    <div>
                      <p className="font-medium">{t('Documents required')}</p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground marker:tabular-nums">
                        {area.docs.map((d) => <li key={d} className="pl-1 text-pretty">{t(d)}</li>)}
                      </ol>
                    </div>
                    <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[13px]">
                      <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span>{t('Kindly send these by')} <b className="font-semibold">{formatDate(deadline)}</b> {t('(within 7 days).')}</span>
                    </p>
                    <div>
                      <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Upload className="size-4" aria-hidden />{t('Upload documents securely')}</span>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3" aria-hidden /><span className="font-mono break-all">{link}</span></p>
                    </div>
                    <p>{t('With regards,')}<br />{t('Internal Audit Team')}<br /><span className="text-muted-foreground">Tripura Small Industries Corporation Ltd</span></p>
                  </div>
                </div>
              </>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50 p-4">
        {step > 1 ? <Button variant="ghost" className="h-10 px-3" onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden />{t('Back')}</Button> : <span />}
        {step < 3
          ? <Button className="h-10 px-4" disabled={!ready} onClick={() => setStep(step + 1)}>{t('Continue')}<ArrowRight aria-hidden /></Button>
          : <Button className="h-10 px-4" disabled={!ready} onClick={send}><Send aria-hidden />{t('Approve & send')}</Button>}
      </div>
    </>
  )
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn('relative min-h-14 rounded-xl border p-3 pr-9 text-left outline-none transition-[border-color,background-color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.985]',
        on ? 'border-foreground bg-foreground/[0.03]' : 'border-border hover:border-foreground/25 hover:bg-muted/40')}>
      {children}
      <span aria-hidden className={cn('absolute top-3 right-3 grid size-5 place-items-center rounded-full border transition-colors duration-150', on ? 'border-foreground bg-foreground text-background' : 'border-border')}>
        {on && <Check className="size-3" />}
      </span>
    </button>
  )
}

export function NewRequestDialog({ open, onOpenChange, onSent }: { open: boolean; onOpenChange: (v: boolean) => void; onSent: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Wizard mounts only while open, so every visit starts fresh. */}
        <Wizard onClose={() => onOpenChange(false)} onSent={onSent} />
      </DialogContent>
    </Dialog>
  )
}
