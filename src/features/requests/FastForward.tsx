import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useT } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { addDays } from './lib'

export const CLOCK_MS = 1400
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Demo-only: a clock spins while the calendar jumps 7 days, so the audience sees time pass. */
export function ClockOverlay({ show, from }: { show: boolean; from: string }) {
  const t = useT()
  const [day, setDay] = useState(0)
  useEffect(() => {
    if (!show) return
    setDay(0)
    const t = setInterval(() => setDay((d) => Math.min(7, d + 1)), CLOCK_MS / 7)
    return () => clearInterval(t)
  }, [show])
  return (
    <AnimatePresence>
      {show && (
        <motion.div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4"
          initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-popover px-5 py-4 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.25)]">
            <svg viewBox="0 0 24 24" className="size-11 text-ai" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9.5" />
              <motion.line x1="12" y1="12" x2="12" y2="5.5" style={{ transformOrigin: '12px 12px' }} animate={{ rotate: 360 * 7 }} transition={{ duration: CLOCK_MS / 1000, ease: 'easeInOut' }} />
              <motion.line x1="12" y1="12" x2="12" y2="8.5" style={{ transformOrigin: '12px 12px' }} animate={{ rotate: 360 }} transition={{ duration: CLOCK_MS / 1000, ease: 'easeInOut' }} />
            </svg>
            <div>
              <p className="text-[13px] text-muted-foreground">{t('Fast-forwarding one week…')}</p>
              <p className="text-xl font-semibold tracking-tight tabular-nums">{formatDate(addDays(from, day))}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{t('Day')} {day} {t('of')} 7</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
