// Run: node src/data/rules.check.ts
// Regression lock for the demo dataset: exact finding counts per rule, so a seed
// edit that silently drops (or doubles) a demo finding fails loudly here.
import { seed } from './seed.ts'
import { RULES, runRules } from './rules.ts'

const eq = (a: unknown, b: unknown, what: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

const data = seed()
eq(data.divisions.length, 5, 'divisions')
eq(RULES.length, 20, 'rules')

const areas = new Set(RULES.map((r) => r.area))
eq(areas.size, 9, 'areas covered by rules')
for (const r of RULES) if (!r.scopeRef || !r.plain) throw new Error(`rule ${r.id} lacks scopeRef/plain`)

const findings = runRules(data)
const byRule = (id: string) => findings.filter((f) => f.ruleId === id).map((f) => f.id).sort()

// exact per-rule counts (see rules.ts for why each fires)
eq(byRule('R01'), ['F-R01-PO-2026-176', 'F-R01-PO-2026-184', 'F-R01-PO-2026-191', 'F-R01-PO-2026-220', 'F-R01-PO-2026-226'], 'R01')
eq(byRule('R02').length, 5, 'R02 count')
eq(byRule('R03'), ['F-R03-PO-2026-201'], 'R03')
eq(byRule('R04').length, 2, 'R04 count')
eq(byRule('R05'), ['F-R05-PO-2026-176'], 'R05')
eq(byRule('R06'), ['F-R06-DOC-0007'], 'R06')
eq(byRule('R07').length, 3, 'R07 count')
eq(byRule('R08').length, 2, 'R08 count')
eq(byRule('R09').length, 3, 'R09 count')
eq(byRule('R10'), ['F-R10-BR-02'], 'R10')
eq(byRule('R11').length, 2, 'R11 count')
eq(byRule('R12').length, 4, 'R12 count')
eq(byRule('R13').length, 1, 'R13 count')
eq(byRule('R14').length, 1, 'R14 count')
eq(byRule('R15'), ['F-R15-DOC-0012'], 'R15')
eq(byRule('R16'), ['F-R16-DOC-0011'], 'R16')
eq(byRule('R17'), ['F-R17-DOC-0004'], 'R17')
eq(byRule('R18'), ['F-R18-DOC-0005'], 'R18')
eq(byRule('R19').length, 2, 'R19 count')
eq(byRule('R20'), ['F-R20-PO-2026-191'], 'R20')
eq(findings.length, 39, 'total findings')

// the demo script's hero finding, with provenance for "why did the AI flag this?"
const hero = findings.find((f) => f.id === 'F-R01-PO-2026-184')!
eq(hero.severity, 'critical', 'hero severity')
eq(hero.amount, 842000, 'hero amount')
if (!hero.basis?.length || !hero.engine || !hero.scopeRef) throw new Error('hero lacks provenance')

// every area raises at least one finding, so no report section is silently empty
for (const a of areas) if (!findings.some((f) => f.area === a)) throw new Error(`area ${a} has no findings`)

// vendor concentration the Purchases page needs (>25% with one vendor)
const totals = new Map<string, number>()
let grand = 0
for (const p of data.purchaseOrders) { totals.set(p.vendor, (totals.get(p.vendor) ?? 0) + p.amount); grand += p.amount }
const top = [...totals].sort((a, b) => b[1] - a[1])[0]
if (top[1] / grand <= 0.25) throw new Error(`no concentrated vendor: ${top[0]} ${(top[1] / grand * 100).toFixed(1)}%`)

console.log(`rules check ok: ${findings.length} findings, 9 areas, top vendor ${top[0]} ${Math.round(top[1] / grand * 100)}%`)
