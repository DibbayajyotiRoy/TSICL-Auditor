import { ask } from '@/lib/ai'
import { AREA_ORDER } from './areas'
import type { Area, Severity } from '@/data/types'

export interface ParsedCheck { name: string; plain: string; area: Area; severity: Severity; source: 'ai' | 'offline' }

export const AREAS = AREA_ORDER
const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

const SYSTEM = `You turn an auditor's plain-English instruction into ONE audit check for a state-owned corporation in Tripura, India.
Reply with ONLY a JSON object, no prose: {"name": "short title, max 6 words", "plain": "one plain sentence a non-technical manager understands", "area": "${AREAS.join('|')}", "severity": "critical|high|medium|low"}`

// ponytail: keyword vote per area + a few severity cues. Upgrade path: none needed, the AI path handles real parsing; this only keeps the demo alive offline.
const AREA_WORDS: [Area, RegExp][] = [
  ['scrap', /scrap|auction|surplus|disposal|e-?waste/gi],
  ['fixed_assets', /asset|equipment|machine|vehicle|furniture|laptop|computer|depreciat|tag\b/gi],
  ['receivables', /receivable|customer|debtor|overdue|outstanding|dues?\b|collection/gi],
  ['cash_bank', /bank|cash|cheque|deposit|payment|withdraw|reconcil|petty/gi],
  ['establishment', /salary|salaries|staff|employee|leave\b|pension|payroll|attendance|recruit|overtime/gi],
  ['compliance', /gst|tds|\btax|statutory|compliance|filing|licen[cs]e|return\b/gi],
  ['internal_controls', /segregation|maker|checker|self[- ]approv|authori[sz]ation|delegat|rotation|conflict of interest|control/gi],
  ['cag', /\bcag\b|comptroller|accountant general|audit para|observation|irregularit/gi],
  ['procurement', /purchase|vendor|supplier|tender|quotation|order|approv|contract/gi],
]

function toRupees(text: string): number {
  const m = text.match(/₹\s*([\d,.]+)\s*(crore|cr|lakh|lac|l)?\b/i) ?? text.match(/\brs\.?\s*([\d,.]+)\s*(crore|cr|lakh|lac|l)?\b/i)
  if (!m) return 0
  const n = parseFloat(m[1].replace(/,/g, '')) || 0
  const u = (m[2] ?? '').toLowerCase()
  return u.startsWith('c') ? n * 1e7 : u.startsWith('l') ? n * 1e5 : n
}

export function parseOffline(input: string): ParsedCheck {
  const text = input.trim().replace(/\s+/g, ' ')
  let area: Area = 'procurement', best = 0
  for (const [a, rx] of AREA_WORDS) {
    const votes = text.match(rx)?.length ?? 0
    if (votes > best) { best = votes; area = a }
  }
  const rupees = toRupees(text)
  const severity: Severity =
    /fraud|forg|critical|urgent|serious/i.test(text) || rupees >= 1e7 ? 'critical'
    : /above|exceed|without|duplicate|split|sunday|holiday|weekend|twice/i.test(text) || rupees >= 5e5 ? 'high'
    : /minor|small|late|delay/i.test(text) ? 'low' : 'medium'
  const sentence = text.charAt(0).toUpperCase() + text.slice(1)
  const plain = /[.!?]$/.test(sentence) ? sentence : sentence + '.'
  const core = text.replace(/^(please\s+)?(flag|alert( me)?( when| if)?|warn( me)?( when| if)?|check|find|highlight|show)\s+(me\s+)?(any|all|every)?\s*/i, '')
  const name = core.length > 46 ? core.slice(0, 46).replace(/\s+\S*$/, '') + '…' : core
  return { name: name.charAt(0).toUpperCase() + name.slice(1), plain, area, severity, source: 'offline' }
}

/** Ask the AI first; null (demo mode / failure) or unusable JSON falls back to the offline reading. */
export async function parseCheck(input: string): Promise<ParsedCheck> {
  const text = await ask(SYSTEM, [{ role: 'user', content: input }], 8000)
  try {
    const j = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] ?? '')
    if (!AREAS.includes(j.area) || !SEVERITIES.includes(j.severity) || typeof j.plain !== 'string' || !j.plain.trim()) return parseOffline(input)
    return { name: String(j.name || j.plain).slice(0, 60), plain: j.plain.trim(), area: j.area, severity: j.severity, source: 'ai' }
  } catch {
    return parseOffline(input)
  }
}
