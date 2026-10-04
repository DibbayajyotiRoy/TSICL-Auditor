// Run: node src/features/procurement/analysis.check.ts
import { analyse, findClusters } from './analysis.ts'

const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }

const po = (id: string, vendor: string, date: string, amount: number, extra = {}) =>
  ({ id, vendor, item: 'x', divisionId: 'D1', date, amount, approvedBy: 'GM', approverLimit: 500_000, quotations: 3, docIds: [], ...extra })

// three 80k orders in 10 days = 240k, one far-off order, one big order (excluded)
const pos = [po('A', 'Acme', '2026-07-01', 80_000), po('B', 'ACME ', '2026-07-06', 80_000), po('C', 'Acme', '2026-07-11', 80_000),
  po('D', 'Acme', '2026-09-01', 80_000), po('E', 'Acme', '2026-07-12', 250_000)]
const c = findClusters(pos)
eq(c.length, 1)
eq(c[0].pos.map((p) => p.id), ['A', 'B', 'C'])
eq(c[0].total, 240_000)

const r = analyse([
  po('F', 'V', '2026-08-01', 700_000, { quotations: 1, grnDate: '2026-08-20', paymentDate: '2026-08-10', invoiceAmount: 720_000 }),
]).rows[0]
eq(r.issues, ['above_limit', 'one_quote', 'paid_early', 'invoice_over'])
eq(r.overBy, 200_000)
console.log('procurement analysis ok')
