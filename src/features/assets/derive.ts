// Pure helpers for the Assets page. No React here.
import { Armchair, Building2, Cog, Laptop, Package, Truck, type LucideIcon } from 'lucide-react'
import type { Asset, Division } from '@/data/types'
import { TODAY } from '@/data/store'

/** Financial year FY 2026-27 starts 1 April: "this year" for physical verification. */
export const FY_START = `${Number(TODAY.slice(5, 7)) >= 4 ? TODAY.slice(0, 4) : Number(TODAY.slice(0, 4)) - 1}-04-01`

export const CATEGORY_ICON: Record<Asset['category'], LucideIcon> = {
  IT: Laptop, Furniture: Armchair, Vehicle: Truck, Machinery: Cog, Building: Building2, Other: Package,
}

export type Status = 'verified' | 'due' | 'damaged' | 'missing'
export type Issue = 'duplicate' | 'mismatch' | 'never'
export const ISSUE_LABEL: Record<Issue, string> = { duplicate: 'Duplicate tag', mismatch: 'Location mismatch', never: 'Never verified' }

/** Physically seen this financial year (a "not found" result does not count). */
export const isChecked = (a: Asset) => !!a.lastVerified && a.lastVerified >= FY_START && a.verification !== 'missing'

export const statusOf = (a: Asset): Status =>
  a.verification === 'missing' ? 'missing' : a.verification === 'damaged' ? 'damaged' : isChecked(a) ? 'verified' : 'due'

/** Issues per asset id. Mismatch = the officer it is assigned to sits at another location. */
export function findIssues(assets: Asset[], divisions: Division[]) {
  const tagCount = new Map<string, number>()
  for (const a of assets) tagCount.set(a.tag, (tagCount.get(a.tag) ?? 0) + 1)
  const officerLoc = new Map(divisions.map((d) => [d.officer, d.location]))
  const out = new Map<string, Issue[]>()
  for (const a of assets) {
    const list: Issue[] = []
    if ((tagCount.get(a.tag) ?? 0) > 1) list.push('duplicate')
    const home = a.assignedTo ? officerLoc.get(a.assignedTo) : undefined
    if (home && home !== a.location) list.push('mismatch')
    if (!a.lastVerified) list.push('never')
    out.set(a.id, list)
  }
  return out
}

export function summarize(assets: Asset[]) {
  const total = assets.length
  const checked = assets.filter(isChecked).length
  const missing = assets.filter((a) => a.verification === 'missing').length
  const damaged = assets.filter((a) => a.verification === 'damaged').length
  const byLoc = new Map<string, { loc: string; total: number; checked: number; dueValue: number }>()
  for (const a of assets) {
    const r = byLoc.get(a.location) ?? { loc: a.location, total: 0, checked: 0, dueValue: 0 }
    r.total++
    if (isChecked(a)) r.checked++
    else r.dueValue += a.cost
    byLoc.set(a.location, r)
  }
  return {
    total,
    value: assets.reduce((s, a) => s + a.cost, 0),
    checked,
    never: assets.filter((a) => !a.lastVerified).length,
    missing,
    damaged,
    pct: total ? Math.round((checked / total) * 100) : 0,
    locations: [...byLoc.values()].sort((a, b) => b.total - a.total),
  }
}

/** Unverified assets grouped by location, biggest group first, high value first inside a group. */
export function checklistGroups(assets: Asset[]) {
  const m = new Map<string, Asset[]>()
  for (const a of assets) if (!isChecked(a)) m.set(a.location, [...(m.get(a.location) ?? []), a])
  return [...m.entries()]
    .map(([loc, items]) => ({ loc, items: items.sort((a, b) => b.cost - a.cost) }))
    .sort((a, b) => b.items.length - a.items.length)
}
