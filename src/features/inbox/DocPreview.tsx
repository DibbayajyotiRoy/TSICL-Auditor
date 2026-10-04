// A rendered "paper" copy of the document, built in HTML, with every extracted value highlighted in soft violet.
// It is a visual stand-in for the scanned original (the demo never stores real files).
import type { ReactNode } from 'react'
import type { AuditDocument, DocKind, Division } from '@/data/types'
import { cn, formatDate, formatINR } from '@/lib/utils'
import { fmtField, hash, humanize, inrWords, rng } from './model'

type Flags = Record<string, 'blurry' | 'missing'>
const DOC: Partial<Record<DocKind, { title: string; num: string; numKeys: string[]; party: string }>> = {
  purchase_order: { title: 'PURCHASE ORDER', num: 'P.O. No.', numKeys: ['poNumber', 'poNo'], party: 'To (Supplier)' },
  invoice: { title: 'TAX INVOICE', num: 'Invoice No.', numKeys: ['invoiceNo', 'invoiceNumber'], party: 'Billed by' },
  grn: { title: 'GOODS RECEIVED NOTE', num: 'GRN No.', numKeys: ['grnNo', 'grnNumber'], party: 'Received from' },
  quotation: { title: 'QUOTATION', num: 'Ref. No.', numKeys: ['quotationNo', 'refNo'], party: 'Quoted by' },
  payment_voucher: { title: 'PAYMENT VOUCHER', num: 'Voucher No.', numKeys: ['voucherNo'], party: 'Paid to' },
  approval_note: { title: 'APPROVAL NOTE', num: 'File No.', numKeys: ['fileNo', 'noteNo', 'refNo'], party: 'Proposed vendor' },
  contract: { title: 'WORK CONTRACT AGREEMENT', num: 'Agreement No.', numKeys: ['contractNo', 'refNo'], party: 'Contractor' },
  scrap_auction: { title: 'SCRAP AUCTION RESULT', num: 'Lot No.', numKeys: ['lotNo'], party: 'Highest bidder' },
}
const FIELD_KEYS = {
  vendor: ['vendor', 'supplier', 'vendorName', 'buyer', 'payee'], amount: ['amount', 'total', 'invoiceAmount', 'value', 'reservePrice'],
  date: ['date', 'poDate', 'invoiceDate', 'grnDate'], item: ['item', 'description'], qty: ['quantity', 'qty'], approver: ['approvedBy'], gstin: ['gstin'],
}

export function DocPreview({ doc, division, flags, active, onActive }: { doc: AuditDocument; division?: Division; flags: Flags; active?: string; onActive: (key?: string) => void }) {
  const f = doc.fields
  const r = rng(doc.id)
  const used = new Set<string>()

  /** A highlighted value. Looks the first matching field up; falls back to plain filler when the field is absent. */
  const hl = (keys: string[], fallback: ReactNode = '—', fmt?: (v: string | number) => string): ReactNode => {
    const key = keys.find((k) => f[k] !== undefined)
    if (!key) return fallback
    used.add(key)
    const flag = flags[key]
    const text = fmt ? fmt(f[key]) : fmtField(key, f[key])
    return (
      <mark
        data-key={key}
        onMouseEnter={() => onActive(key)} onMouseLeave={() => onActive(undefined)} onClick={() => onActive(key)}
        className={cn(
          'cursor-pointer rounded-[3px] px-1 py-px text-inherit ring-1 transition-colors duration-150',
          flag ? 'bg-sev-high/15 ring-sev-high/40' : active === key ? 'bg-ai/30 ring-ai/60' : 'bg-ai/[0.14] ring-ai/25 hover:bg-ai/25',
          flag === 'blurry' && 'blur-[1.2px]',
        )}
      >
        {flag === 'missing' ? <span className="inline-block min-w-12 text-center text-neutral-400">——</span> : text}
      </mark>
    )
  }
  const num = (v: string | number | undefined, d = 0) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, '')) || d)

  const meta = DOC[doc.kind]
  const total = num(f[FIELD_KEYS.amount.find((k) => f[k] !== undefined) ?? ''], 100000 + Math.round(r() * 700000))
  const qty = num(f[FIELD_KEYS.qty.find((k) => f[k] !== undefined) ?? ''], 10)
  const sub = Math.round(total / 1.18)
  const gst = total - sub
  const rate = Math.round(sub / qty)

  let body: ReactNode
  if (doc.kind === 'bank_statement') {
    const rows = Array.from({ length: 6 }, (_, i) => { const amt = Math.round((5000 + r() * 400000) / 10) * 10; return { d: `${String(2 + i * 4).padStart(2, '0')} ${['Jul', 'Aug', 'Sep'][i % 3]}`, n: ['NEFT-RECEIPT', 'RTGS-DEALER PMT', 'CHQ ISSUED', 'SALARY BATCH', 'UPI-COLLECTION', 'GST CHALLAN'][i], dr: i % 2 ? amt : 0, cr: i % 2 ? 0 : amt } })
    body = (
      <>
        <Grid>
          <KV k="Bank">{hl(['bank'])}</KV><KV k="Account">{hl(['account'])}</KV><KV k="Period">{hl(['period'])}</KV>
          <KV k="Branch">Agartala Main</KV>
        </Grid>
        <Table head={['Date', 'Narration', 'Debit (₹)', 'Credit (₹)']} right={[2, 3]} rows={rows.map((x) => [x.d, x.n, x.dr ? x.dr.toLocaleString('en-IN') : '', x.cr ? x.cr.toLocaleString('en-IN') : ''])} />
        <p className="mt-3 flex justify-between border-t border-neutral-300 pt-2 font-semibold"><span>Closing balance</span><span>{hl(['closingBalance'], formatINR(total * 12))}</span></p>
      </>
    )
  } else if (doc.kind === 'asset_register') {
    const items = ['Laptop computer', 'Weaving loom (handloom)', 'Office almirah', 'Generator set 15 kVA', 'Air conditioner 1.5T']
    body = (
      <>
        <Grid><KV k="Location">{hl(['location'])}</KV><KV k="As on">{formatDate('2026-09-30')}</KV><KV k="Assets listed">{hl(['assetCount'])}</KV></Grid>
        <Table head={['Tag', 'Description', 'Cost (₹)']} right={[2]} rows={items.map((x, i) => [`TSICL-${String(190 + i * 7).padStart(6, '0')}`, x, (25000 + hash(x) % 400000).toLocaleString('en-IN')])} />
        <p className="mt-3 flex justify-between border-t border-neutral-300 pt-2 font-semibold"><span>Total cost</span><span>{hl(['totalCost'], formatINR(total * 9))}</span></p>
      </>
    )
  } else {
    const m = meta ?? { title: doc.kind.replace(/_/g, ' ').toUpperCase(), num: 'Ref. No.', numKeys: ['refNo'], party: 'Party' }
    const dateKeys = Object.keys(f).filter((k) => /date|till/i.test(k)).sort()
    body = (
      <>
        <Grid>
          <KV k={m.num}>{hl(m.numKeys, `${doc.id.replace('DOC-', 'REF-')}`)}</KV>
          <KV k="Date">{hl([...FIELD_KEYS.date, ...dateKeys], formatDate('2026-09-12'))}</KV>
          <KV k={m.party}>{hl(FIELD_KEYS.vendor, 'M/s Local Supplier')}</KV>
          <KV k="Supplier GSTIN">{hl(FIELD_KEYS.gstin, '—')}</KV>
          <KV k="Division">{division ? `${division.name}, ${division.location}` : 'Head Office, Agartala'}</KV>
          <KV k="Subject">Supply of {hl(FIELD_KEYS.item, 'goods as per specification')}</KV>
        </Grid>
        <Table
          head={['#', 'Description', 'Qty', 'Rate (₹)', 'Amount (₹)']} right={[2, 3, 4]}
          rows={[
            ['1', hl(FIELD_KEYS.item, 'Goods as per specification'), hl(FIELD_KEYS.qty, String(qty), (v) => String(v)), rate.toLocaleString('en-IN'), sub.toLocaleString('en-IN')],
            ['2', 'Packing, forwarding and insurance', '—', '—', 'Included'],
          ]}
        />
        <div className="ml-auto mt-3 w-full max-w-[250px] space-y-1">
          <p className="flex justify-between"><span>Taxable value</span><span className="tabular-nums">{sub.toLocaleString('en-IN')}</span></p>
          <p className="flex justify-between"><span>GST @ 18%</span><span className="tabular-nums">{gst.toLocaleString('en-IN')}</span></p>
          <p className="flex justify-between border-t border-neutral-400 pt-1 text-[12.5px] font-semibold"><span>Grand total (₹)</span><span className="tabular-nums">{hl(FIELD_KEYS.amount, total.toLocaleString('en-IN'), (v) => num(v).toLocaleString('en-IN'))}</span></p>
        </div>
        <p className="mt-3 italic text-neutral-600">Amount in words: Rupees {inrWords(total)} only.</p>
        <ol className="mt-3 list-decimal space-y-0.5 pl-4 text-[10.5px] text-neutral-600">
          <li>Delivery within 30 days of this order at the Corporation's godown.</li>
          <li>Payment within 30 days of the goods received note and a correct tax invoice.</li>
          <li>Goods are subject to inspection and may be rejected if they differ from specification.</li>
        </ol>
      </>
    )
  }
  const approver = hl(FIELD_KEYS.approver, 'Authorised officer')
  const left = Object.keys(f).filter((k) => !used.has(k))

  return (
    <article aria-label={`Preview of ${doc.name}`} className="mx-auto w-full max-w-[540px] rounded-[3px] bg-white p-5 text-[11.5px] leading-[1.55] text-neutral-800 shadow-[0_1px_2px_rgb(0_0_0/0.08),0_12px_32px_-12px_rgb(0_0_0/0.25)] ring-1 ring-black/5 sm:p-7">
      <header className="flex items-center gap-3 border-b-2 border-neutral-800 pb-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-neutral-800 font-serif text-[15px] font-bold">T</span>
        <div className="min-w-0">
          <p className="font-serif text-[13.5px] font-bold uppercase leading-tight tracking-wide sm:text-[15px]">Tripura Small Industries Corporation Ltd.</p>
          <p className="text-[10.5px] text-neutral-600">A Government of Tripura Undertaking · Industrial Estate, Agartala – 799 001</p>
        </div>
      </header>
      <h3 className="my-3 text-center text-[12.5px] font-bold tracking-[0.18em] underline underline-offset-4">{(meta?.title ?? doc.kind.replace(/_/g, ' ').toUpperCase())}</h3>
      {body}
      {left.length > 0 && (
        <div className="mt-3 border-t border-dashed border-neutral-300 pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Other particulars</p>
          <Grid>{left.map((k) => <KV key={k} k={humanize(k)}>{hl([k])}</KV>)}</Grid>
        </div>
      )}
      <footer className="mt-6 flex items-end justify-between gap-4 text-[10.5px]">
        <div><p className="text-neutral-500">Approved by</p><p className="font-medium">{approver}</p></div>
        <div className="text-center">
          <svg viewBox="0 0 120 36" className="mx-auto h-8 w-24 text-neutral-700" aria-hidden><path d="M4 26c10-18 14-18 10-4s6 6 14-6c6-8 4 8 12 2s8-10 14-4 8 4 16-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <p className="border-t border-neutral-500 px-3 pt-0.5 text-neutral-600">Authorised signatory</p>
        </div>
      </footer>
    </article>
  )
}

const Grid = ({ children }: { children: ReactNode }) => <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</dl>
const KV = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="min-w-0"><dt className="text-[10px] uppercase tracking-wide text-neutral-500">{k}</dt><dd className="break-words font-medium">{children}</dd></div>
)
function Table({ head, rows, right }: { head: string[]; rows: ReactNode[][]; right: number[] }) {
  return (
    <table className="mt-3 w-full border-collapse text-[11px]">
      <thead><tr className="border-y border-neutral-400 bg-neutral-100">{head.map((h, i) => <th key={h} className={cn('px-1.5 py-1 font-semibold', right.includes(i) ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, ri) => <tr key={ri} className="border-b border-neutral-200">{row.map((c, i) => <td key={i} className={cn('px-1.5 py-1 align-top tabular-nums', right.includes(i) && 'text-right')}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}
