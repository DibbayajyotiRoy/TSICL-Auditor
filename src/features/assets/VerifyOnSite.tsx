// "Verify on site": phone-style scanner. Real QR scan via BarcodeDetector when available; "Simulate scan" always works.
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, QrCode, ScanLine, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAudit } from '@/data/store'
import type { Asset } from '@/data/types'
import { play } from '@/lib/sound'
import { cn, formatDate, formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { CATEGORY_ICON, isChecked } from './derive'

type Result = NonNullable<Asset['verification']>
type Phase = 'idle' | 'scanning' | 'result' | 'recorded'
interface Detector { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> }
// ponytail: BarcodeDetector is not in lib.dom yet, so a 2-line local type instead of a polyfill dependency
const Det = (window as unknown as { BarcodeDetector?: new (o?: { formats: string[] }) => Detector }).BarcodeDetector
const DEMO_TAG = 'TSICL-000193'
const SCAN_MS = 1700
const BOX = 150 // px the scan line travels; the viewfinder is a fixed 200px tall

const CHOICES: { result: Result; label: string; icon: typeof Check; tone: string; hover: string }[] = [
  { result: 'found', label: 'Found', icon: Check, tone: 'bg-sev-ok/10 text-sev-ok', hover: 'hover:bg-sev-ok/20' },
  { result: 'damaged', label: 'Damaged', icon: TriangleAlert, tone: 'bg-sev-high/10 text-sev-high', hover: 'hover:bg-sev-high/20' },
  { result: 'missing', label: 'Not found', icon: X, tone: 'bg-sev-critical/10 text-sev-critical', hover: 'hover:bg-sev-critical/20' },
]
const OUTCOME_TEXT: Record<Result, string> = { found: 'Marked as found', damaged: 'Marked as damaged', missing: 'Marked as not found', pending: 'Saved' }

function Row({ k, v, amber }: { k: string; v: string; amber?: boolean }) {
  const t = useT()
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{t(k)}</dt>
      <dd className={cn('truncate text-[13px] font-medium tabular-nums', amber && 'text-sev-medium')}>{v}</dd>
    </div>
  )
}

function Phone({ session, onVerified, onClose }: { session: number; onVerified: () => void; onClose: () => void }) {
  const t = useT()
  const assets = useAudit((s) => s.assets)
  const verifyAsset = useAudit((s) => s.verifyAsset)
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [asset, setAsset] = useState<Asset | null>(null)
  const [outcome, setOutcome] = useState<Result | null>(null)
  const [camera, setCamera] = useState(false)
  const [note, setNote] = useState('')
  const seen = useRef(new Set<string>()) // assets already shown this session
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef(0)

  const stopCamera = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCamera(false) }
  // Close = unmount, so this also covers "stop camera tracks on close".
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); clearTimeout(timer.current) }, [])

  const show = (a: Asset) => { seen.current.add(a.id); setAsset(a); setOutcome(null); setNote(''); setPhase('result'); play('confirm') }

  const simulate = () => {
    // Demo script first (TSICL-000193), then whatever still needs a physical check.
    const due = assets.filter((a) => !isChecked(a) && !seen.current.has(a.id))
    const next = due.find((a) => a.tag === DEMO_TAG) ?? due[0] ?? assets.find((a) => !seen.current.has(a.id))
    if (!next) { setNote(t('Every asset in the register has been seen.')); setPhase('idle'); return }
    stopCamera(); setNote(''); setPhase('scanning')
    timer.current = window.setTimeout(() => show(next), SCAN_MS)
  }

  const startCamera = async () => {
    setNote('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setCamera(true); setPhase('scanning')
    } catch {
      setNote(t('Camera is not available. Use Simulate scan for the demo.'))
    }
  }

  // Camera loop: ~2.5 fps is plenty for a QR tag held still.
  useEffect(() => {
    if (!camera || phase !== 'scanning' || !Det) return
    const v = video.current
    if (!v) return
    const det = new Det({ formats: ['qr_code'] })
    v.srcObject = stream.current
    void v.play().catch(() => {})
    let stop = false
    let tm = 0
    const tick = async () => {
      if (stop) return
      try {
        const [hit] = v.readyState >= 2 ? await det.detect(v) : []
        const found = hit && assets.find((a) => hit.rawValue.includes(a.tag))
        if (found) { if (!stop) show(found); return }
        if (hit) setNote(`${t('That tag is not in the register:')} ${hit.rawValue.slice(0, 28)}`)
      } catch { /* frame not ready, try again */ }
      tm = window.setTimeout(tick, 400)
    }
    void tick()
    return () => { stop = true; clearTimeout(tm) }
  }, [camera, phase, assets])

  const decide = (r: Result) => {
    if (!asset) return
    verifyAsset(asset.id, r) // the store plays success / warning
    if (r === 'missing') play('error')
    if (r !== 'missing') onVerified()
    setOutcome(r); setPhase('recorded')
  }
  const cancel = () => { clearTimeout(timer.current); stopCamera(); setPhase('idle') }
  const next = () => (camera ? setPhase('scanning') : simulate())

  const Icon = asset ? CATEGORY_ICON[asset.category] : QrCode
  const done = CHOICES.find((c) => c.result === outcome)

  return (
    <div className="relative flex h-[min(720px,calc(100dvh-2rem))] w-full flex-col overflow-hidden rounded-[40px] border-[9px] border-neutral-900 bg-background shadow-2xl ring-1 ring-white/15">
      <div aria-hidden className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
      <div className="flex flex-col gap-1 px-5 pb-3 pt-10">
        <DialogTitle className="text-[17px] font-semibold tracking-tight">{t('Verify on site')}</DialogTitle>
        <motion.p key={session} initial={reduce ? false : { y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Check className="size-3.5 text-sev-ok" aria-hidden />
          <span className="font-medium tabular-nums text-foreground">{session}</span> {t('verified this session')}
        </motion.p>
      </div>

      <div className="relative mx-4 h-[200px] shrink-0 overflow-hidden rounded-3xl bg-neutral-950">
        {camera && <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover" />}
        {!camera && <QrCode className="absolute inset-0 m-auto size-16 text-white/10" strokeWidth={1.25} aria-hidden />}
        <div className="absolute inset-6">
          {(['left-0 top-0 rounded-tl-xl border-l-2 border-t-2', 'right-0 top-0 rounded-tr-xl border-r-2 border-t-2', 'bottom-0 left-0 rounded-bl-xl border-b-2 border-l-2', 'bottom-0 right-0 rounded-br-xl border-b-2 border-r-2'] as const).map((c) => (
            <span key={c} className={cn('absolute size-7 transition-colors duration-200', c, phase === 'result' || phase === 'recorded' ? 'border-sev-ok' : 'border-white/80')} />
          ))}
          {phase === 'scanning' && (
            <motion.div className="absolute inset-x-1 top-0 h-0.5 rounded-full bg-sev-ok shadow-[0_0_14px_2px_var(--sev-ok)]"
              initial={{ y: reduce ? BOX / 2 : 0 }}
              animate={reduce ? undefined : { y: [0, BOX, 0] }}
              transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }} />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4">
        {phase === 'idle' && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[15px] font-medium">{t('Scan the QR tag on the asset')}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{t("TSICL's register opens instantly so you can mark what you see.")}</p>
            </div>
            <Button className="h-12 gap-2 rounded-2xl text-[15px]" onClick={simulate} disabled={!assets.length}><ScanLine /> {t('Simulate scan')}</Button>
            {Det && <Button variant="outline" className="h-11 rounded-2xl" onClick={startCamera}>{t('Use camera')}</Button>}
            {note && <p className="text-[13px] text-sev-high" role="status">{note}</p>}
          </div>
        )}

        {phase === 'scanning' && (
          <div className="flex flex-col items-center gap-2 pt-2 text-center" role="status">
            <p className="text-[15px] font-medium">{camera ? t('Point at the QR tag') : t('Reading the tag…')}</p>
            <p className="text-[13px] text-muted-foreground">{note || t('Hold steady, this takes a moment.')}</p>
            <Button variant="ghost" className="mt-1 h-10 px-4" onClick={cancel}>{t('Cancel')}</Button>
          </div>
        )}

        {phase === 'result' && asset && (
          <motion.div initial={reduce ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">Asset #{asset.tag}</p>
                  <p className="truncate text-[15px] font-medium">{asset.name}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                <Row k="Cost" v={formatINR(asset.cost)} />
                <Row k="Location" v={asset.location} />
                <Row k="Assigned to" v={asset.assignedTo ?? t('Unassigned')} />
                <Row k="Last verified" v={asset.lastVerified ? formatDate(asset.lastVerified) : t('Never')} amber={!asset.lastVerified} />
              </dl>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CHOICES.map(({ result, label, icon: I, tone, hover }) => (
                <button key={result} type="button" onClick={() => decide(result)}
                  className={cn('flex h-[92px] flex-col items-center justify-center gap-2 rounded-2xl text-[13px] font-medium outline-none transition-[background-color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]', tone, hover)}>
                  <I className="size-7" strokeWidth={2.25} aria-hidden />
                  {t(label)}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'recorded' && done && asset && (
          <motion.div initial={reduce ? false : { scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex flex-col items-center gap-3 pt-1 text-center" role="status">
            <span className={cn('grid size-12 place-items-center rounded-full', done.tone)}><done.icon className="size-6" strokeWidth={2.25} aria-hidden /></span>
            <div>
              <p className="text-[15px] font-medium">{outcome ? t(OUTCOME_TEXT[outcome]) : ''}</p>
              <p className="font-mono text-xs text-muted-foreground">{asset.tag} · {t('saved to the register')}</p>
            </div>
            <Button className="h-12 w-full gap-2 rounded-2xl text-[15px]" onClick={next}><ScanLine /> {t('Next asset')}</Button>
          </motion.div>
        )}
      </div>

      <div className="px-4 pb-4 pt-1">
        <Button variant="ghost" className="h-10 w-full rounded-2xl text-muted-foreground" onClick={onClose}>{t('Finish session')}</Button>
      </div>
    </div>
  )
}

export function VerifyOnSite({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT()
  const [session, setSession] = useState(0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}
        className="w-[340px] max-w-[calc(100vw-1.5rem)] gap-0 border-0 bg-transparent p-0 ring-0 sm:max-w-[340px]">
        <DialogDescription className="sr-only">{t("Scan an asset's QR tag and record whether it was found, damaged or not found.")}</DialogDescription>
        <Phone session={session} onVerified={() => setSession((n) => n + 1)} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
