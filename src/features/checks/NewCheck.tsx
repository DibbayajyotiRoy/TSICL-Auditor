import { useState } from 'react'
import { Loader2, Sparkles, WandSparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAudit } from '@/data/store'
import { SEVERITY_LABEL, type Area, type Rule, type Severity } from '@/data/types'
import { play } from '@/lib/sound'
import { useT } from '@/lib/i18n'
import { areaName } from './areas'
import { AREAS, parseCheck, type ParsedCheck } from './parseCheck'

const EXAMPLES = [
  'Flag any payment above ₹5 lakh made on a Sunday',
  'Alert me when a customer has not paid for over 180 days',
  'Highlight any asset bought for more than ₹1 lakh without a tag',
]

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT()
  return <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">{t(label)}</p>{children}</div>
}

export function NewCheck() {
  const t = useT()
  const reduce = useReducedMotion()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ParsedCheck | null>(null)

  const interpret = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    const p = await parseCheck(text)
    setParsed(p)
    setBusy(false)
  }

  const add = () => {
    if (!parsed) return
    const used = new Set(useAudit.getState().rules.map((r) => r.id))
    let n = 1
    while (used.has(`U${String(n).padStart(2, '0')}`)) n++
    const rule: Rule = { id: `U${String(n).padStart(2, '0')}`, name: parsed.name, plain: parsed.plain, area: parsed.area, severity: parsed.severity, enabled: true }
    useAudit.setState((s) => ({ rules: [...s.rules, rule] }))
    useAudit.getState().log('ai', `New check added: ${rule.name}`)
    play('confirm')
    toast.success(t('Check added'), { description: `${t('It will run in the next audit, under')} “${t(areaName(rule.area))}”.` })
    setParsed(null)
    setText('')
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <WandSparkles className="size-4 text-ai" aria-hidden />
        <h2 className="text-[15px] font-semibold tracking-tight">{t('Write a new check in plain English')}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('Describe what you want watched. The assistant turns it into a check — you review it before it is added.')}</p>

      <form onSubmit={interpret} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('e.g. Flag any payment above ₹5 lakh made on a Sunday')}
          aria-label={t('Describe the new check')} className="h-11 flex-1 px-3 text-[15px] md:text-[15px]" />
        <Button type="submit" size="lg" disabled={!text.trim() || busy} className="h-11 px-4 text-sm">
          {busy ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {busy ? t('Reading…') : t('Turn into a check')}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setText(ex)}
            className="rounded-full border border-border px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.98] max-sm:min-h-10">
            {ex}
          </button>
        ))}
      </div>

      {parsed && (
        <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-5 rounded-xl border border-ai/25 bg-ai/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ai">
            <Sparkles className="size-3.5" aria-hidden />
            {parsed.source === 'ai' ? t('The assistant understood this as') : t('Read offline — please check the area and seriousness')}
          </p>
          <p className="mt-2 text-pretty text-[15px] font-medium leading-snug">{parsed.plain}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{parsed.name}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Labelled label="Which area">
              <Select value={parsed.area} onValueChange={(v) => setParsed({ ...parsed, area: v as Area })}>
                <SelectTrigger className="h-10 w-full" aria-label={t('Area')}><SelectValue /></SelectTrigger>
                <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{t(areaName(a))}</SelectItem>)}</SelectContent>
              </Select>
            </Labelled>
            <Labelled label="How serious">
              <Select value={parsed.severity} onValueChange={(v) => setParsed({ ...parsed, severity: v as Severity })}>
                <SelectTrigger className="h-10 w-full" aria-label={t('Seriousness')}><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => <SelectItem key={s} value={s}>{t(SEVERITY_LABEL[s])}</SelectItem>)}</SelectContent>
              </Select>
            </Labelled>
          </div>
          <p className="mt-3 text-xs font-medium text-ai">{t('New — will run in next audit')}</p>
          <div className="mt-4 flex gap-2">
            <Button size="lg" className="h-10 px-4" onClick={add}>{t('Add check')}</Button>
            <Button size="lg" variant="ghost" className="h-10 px-4" onClick={() => setParsed(null)}>{t('Discard')}</Button>
          </div>
        </motion.div>
      )}
    </section>
  )
}
