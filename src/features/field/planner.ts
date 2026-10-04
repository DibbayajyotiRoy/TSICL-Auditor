// Visit-planner maths. Self-check: node --experimental-strip-types src/features/field/planner.ts
import type { Division, Finding, Severity } from '@/data/types'

// Approximate road km from Agartala HO. ponytail: lookup by place name; unknown places default to 120 km. Move to Division data if it grows.
const KM: Record<string, number> = { arundhutinagar: 5, bishalgarh: 30, khowai: 50, udaipur: 55, teliamura: 70, belonia: 90, ambassa: 90, sabroom: 135, kailashahar: 150, dharmanagar: 200 }
export function distanceKm(location: string): number {
  const l = location.toLowerCase()
  const hit = Object.keys(KM).find((k) => l.includes(k))
  return hit ? KM[hit] : l.includes('agartala') ? 0 : 120
}

const WEIGHT: Record<Severity, number> = { critical: 8, high: 4, medium: 2, low: 1 }
export type Priority = 'first' | 'quarter' | 'desk'
export interface DivisionRisk { division: Division; km: number; open: number; urgent: number; amount: number; score: number; level: Priority }

/** Open issues weighted by severity -> a risk score; sorted riskiest first (nearer first on ties). */
export function riskByDivision(divisions: Division[], findings: Finding[]): DivisionRisk[] {
  const live = findings.filter((f) => f.status === 'open' || f.status === 'investigating')
  const rows = divisions.map((division) => {
    const mine = live.filter((f) => f.divisionId === division.id)
    return {
      division, km: distanceKm(division.location), open: mine.length,
      urgent: mine.filter((f) => f.severity === 'critical').length,
      amount: mine.reduce((a, f) => a + f.amount, 0),
      score: mine.reduce((a, f) => a + WEIGHT[f.severity], 0),
      level: 'desk' as Priority,
    }
  })
  const max = Math.max(0, ...rows.map((r) => r.score))
  for (const r of rows) r.level = r.score >= 0.6 * max && r.score > 0 ? 'first' : r.score >= 0.25 * max && r.score > 0 ? 'quarter' : 'desk'
  return rows.sort((a, b) => b.score - a.score || a.km - b.km)
}

export interface Stop { risk: DivisionRisk; start: string; end: string }
const addDay = (d: Date, n = 1) => new Date(d.getTime() + n * 864e5)
const noSunday = (d: Date) => (d.getUTCDay() === 0 ? addDay(d) : d)
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Riskiest field offices first, no Sundays, 2 days for anything over 100 km, 3 office days between trips. */
export function buildRoute(risks: DivisionRisk[], from = '2026-10-12', max = 6): Stop[] {
  let cursor = noSunday(new Date(from))
  return risks.filter((r) => r.km > 0 && r.score > 0).slice(0, max).map((risk) => {
    const start = cursor
    const end = risk.km > 100 ? noSunday(addDay(start)) : start
    cursor = noSunday(addDay(end, 3))
    return { risk, start: iso(start), end: iso(end) }
  })
}

const dm = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtRange = (s: string, e: string) => (s === e ? dm.format(new Date(s)) : `${dm.format(new Date(s))} – ${dm.format(new Date(e))}`)

const g = globalThis as { process?: { argv: string[] } }
if (g.process?.argv[1]?.endsWith('planner.ts')) {
  const stops = buildRoute([{ km: 200, score: 9 }, { km: 5, score: 5 }, { km: 55, score: 3 }, { km: 0, score: 4 }] as DivisionRisk[])
  if (stops.length !== 3) throw new Error('head-office division must not be routed')
  if (stops[0].start !== '2026-10-12' || stops[0].end !== '2026-10-13') throw new Error('first trip: Mon-Tue')
  for (const s of stops) for (const d of [s.start, s.end]) if (new Date(d).getUTCDay() === 0) throw new Error('Sunday trip ' + d)
  if (distanceKm('Udaipur, Gomati') !== 55 || distanceKm('Agartala HO') !== 0 || distanceKm('Arundhutinagar, Agartala') !== 5) throw new Error('distance lookup')
  console.log('planner.ts: all checks passed')
}
