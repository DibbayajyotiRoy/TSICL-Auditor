// Run: node src/features/receivables/logic.check.ts   (Node 22+, no deps)
import type { BankReceipt, Receivable } from '../../data/types.ts'
import { ageInfo, ageing, oldMoney, suggestMatch } from './logic.ts'

const ok = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m) }
const rec = (id: string, customer: string, amount: number, invoiceDate: string, lastPaymentDate?: string): Receivable =>
  ({ id, customer, divisionId: 'D1', invoiceNo: `INV/2026/0${id}`, invoiceDate, amount, lastPaymentDate })
const T = '2026-10-04'
const recs = [
  rec('412', 'Dept. of Rural Development', 320000, '2025-12-01', '2025-12-18'), // 290 days
  rec('413', 'Tripura University', 150000, '2026-09-20'), // 14 days
  rec('414', 'Tripura Tourism Board', 150000, '2026-05-01'), // 156 days
]
ok(ageInfo(recs[0], T).days === 290 && ageInfo(recs[0], T).bucket === 3, 'age/bucket')
ok(ageInfo(recs[1], T).bucket === 0 && !ageInfo(recs[1], T).paid, 'fresh invoice')
const a = ageing(recs, T)
ok(a[3].amount === 320000 && a[0].count === 1 && a[2].count === 1, 'ageing buckets')
const om = oldMoney(recs, T)
ok(om.total === 320000 && om.top[0].name.startsWith('Dept') && om.govt, 'old money + govt')

const rc = (amount: number, narration: string): BankReceipt => ({ id: 'B1', date: T, amount, narration })
const s1 = suggestMatch(rc(150000, 'NEFT-TRIPURA UNIV-ACAD FEES'), recs)
ok(s1?.receivable.id === '413' && s1.score >= 0.9, 'amount + name picks University over Tourism')
const s2 = suggestMatch(rc(320000, 'RTGS RURAL DEVLP DEPT INV 0412'), recs)
ok(s2?.receivable.id === '412', 'invoice no + name')
ok(suggestMatch(rc(150000, 'NEFT-TRIPURA UNIV'), recs, ['413'])?.receivable.id !== '413', 'skip list honoured')
ok(suggestMatch(rc(5, 'xyz'), recs) === null, 'no weak match')
const tt = [rec('501', 'Tripura Tourism Development Corporation', 389000, '2025-11-20'), rec('502', 'Dept. of Education', 215000, '2026-02-04')]
ok(suggestMatch(rc(210000, 'RTGS TOURISM DEV CORP'), tt)?.receivable.id === '501', 'name beats near-amount')
ok(suggestMatch(rc(210000, 'UPI MISC CREDIT'), tt) === null, 'near amount alone is not a suggestion')
console.log('receivables logic: ok')
