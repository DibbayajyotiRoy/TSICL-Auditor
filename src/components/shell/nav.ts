import {
  CalendarCheck, FileText, IndianRupee, Inbox, ListChecks, MapPin, Package, Send, ShieldAlert, ShoppingCart, Sparkles,
  type LucideIcon,
} from 'lucide-react'

/** A page link (`to`) or an action row (`action`). */
export interface NavItem { to?: string; action?: 'assistant'; label: string; icon: LucideIcon; badge?: 'findings' }
// Labels are i18n keys (English sentences), passed through useT() where rendered. A group without a label renders no heading.
export const NAV: { label?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Today', icon: CalendarCheck }] },
  { label: 'Audit', items: [
    { to: '/inbox', label: 'Document Inbox', icon: Inbox },
    { to: '/requests', label: 'Requests & Follow-ups', icon: Send },
    { to: '/findings', label: 'Findings', icon: ShieldAlert, badge: 'findings' },
    { to: '/procurement', label: 'Purchases', icon: ShoppingCart },
    { to: '/receivables', label: 'Money Owed', icon: IndianRupee },
    { to: '/assets', label: 'Assets', icon: Package },
    { to: '/checks', label: 'Audit Checks', icon: ListChecks },
    { to: '/field', label: 'Field Visits', icon: MapPin },
  ] },
  { label: 'Reporting', items: [{ to: '/report', label: 'Quarterly Report', icon: FileText }] },
  { label: 'Assist', items: [{ action: 'assistant', label: 'Ask AI', icon: Sparkles }] },
]
export type PageItem = NavItem & { to: string }
export const PAGES = NAV.flatMap((g) => g.items).filter((i): i is PageItem => !!i.to)
export const isActive = (to: string, path: string) => (to === '/' ? path === '/' : path === to || path.startsWith(to + '/'))
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl '
/** Let the dropdown/dialog finish closing (and return focus) before the tour grabs the screen. */
export const startTour = () => setTimeout(() => window.dispatchEvent(new Event('start-tour')), 180)
