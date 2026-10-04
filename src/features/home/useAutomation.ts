import { useEffect } from 'react'
import { useAudit } from '@/data/store'
import { useUI } from '@/lib/ui'
import type { DocKind } from '@/data/types'

const VENDORS = ['Tripura Steel Works', 'Agartala Stationers', 'Gomati Traders', 'North East Cement Depot', 'Unakoti Timber Mart', 'Sepahijala Agro Supplies']
const KINDS: { kind: DocKind; name: (n: number, v: string) => string }[] = [
  { kind: 'invoice', name: (n, v) => `Invoice_${n}_${v.split(' ')[0]}.pdf` },
  { kind: 'purchase_order', name: (n) => `PO-2026-${n}.pdf` },
  { kind: 'payment_voucher', name: (n) => `PV_${n}_Sep2026.pdf` },
  { kind: 'grn', name: (n) => `GRN-${n}.pdf` },
  { kind: 'quotation', name: (n, v) => `Quotation_${v.split(' ')[0]}_${n}.pdf` },
]
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
let seq = 0 // module-level so ids stay unique across visits

/**
 * Demo magic: while Today is open, a mailroom "automation" event lands every ~12s
 * (a document arrives, or a scheduled follow-up goes out). Capped per visit; the interval is cleared on unmount.
 * Always silent: store actions may play sounds, so sound is muted for the duration of each (synchronous) tick.
 */
export function useAutomation(everyMs = 12000, max = 4) {
  useEffect(() => {
    let n = 0
    const id = setInterval(() => {
      const { soundOn } = useUI.getState()
      useUI.setState({ soundOn: false })
      try {
        const { divisions, requests, addDocument, log } = useAudit.getState()
        const div = divisions.length ? pick(divisions) : undefined
        if (n % 3 === 1 || !div) {
          const open = requests.filter((r) => r.stage !== 'completed')
          log('reminder', div
            ? `Scheduled follow-up sent to ${div.officer} (${div.name})${open.length ? ` — ${pick(open).subject}` : ' for pending records'}`
            : 'Scheduled follow-up sent for pending records')
        } else {
          const { kind, name } = pick(KINDS)
          const vendor = pick(VENDORS)
          const confidence = 0.78 + Math.random() * 0.2
          addDocument({
            id: `DOC-${9000 + ++seq}`,
            name: name(300 + Math.floor(Math.random() * 600), vendor),
            kind, divisionId: div.id, receivedAt: new Date().toISOString(),
            source: 'email', from: div.email,
            status: confidence < 0.85 ? 'needs_review' : 'extracted', confidence,
            fields: { vendor, amount: Math.round((8000 + Math.random() * 900000) / 100) * 100 },
            pages: 1 + Math.floor(Math.random() * 5),
          })
        }
      } finally { useUI.setState({ soundOn }) }
      if (++n >= max) clearInterval(id)
    }, everyMs)
    return () => clearInterval(id)
  }, [everyMs, max])
}
