import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Compass, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI } from '@/lib/ui'
import { useAudit } from '@/data/store'
import { useT } from '@/lib/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconBtn } from './controls'
import { NAV, isActive, startTour, type NavItem } from './nav'

function NavRow({ item, active, collapsed, count, pillId, onClick }: {
  item: NavItem; active: boolean; collapsed: boolean; count: number; pillId: string; onClick: () => void
}) {
  const t = useT()
  const Icon = item.icon
  const label = t(item.label)
  const cls = cn(
    'relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium transition-colors duration-150',
    collapsed && 'justify-center px-0',
    active ? 'text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
  )
  const inner = (
    <>
      {active && (
        <motion.span layoutId={pillId} transition={{ type: 'spring', stiffness: 500, damping: 42 }}
          className="absolute inset-0 rounded-lg bg-card shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-foreground/[0.07]" />
      )}
      <Icon className={cn('relative size-[18px] shrink-0', item.action && 'text-ai')} aria-hidden />
      {collapsed ? <span className="sr-only">{label}</span> : <span className="relative min-w-0 flex-1 truncate">{label}</span>}
      {count > 0 && (collapsed
        ? <span className="absolute top-2 right-2.5 size-2 rounded-full bg-foreground ring-2 ring-sidebar" aria-hidden />
        : <span aria-label={`${count} ${t('open')}`} className="relative grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold tabular-nums text-background">{count}</span>)}
    </>
  )
  const el = item.to
    ? <Link to={item.to} onClick={onClick} aria-current={active ? 'page' : undefined} className={cls}>{inner}</Link>
    : <button type="button" onClick={onClick} className={cls}>{inner}</button>
  if (!collapsed) return el
  return (
    <Tooltip>
      <TooltipTrigger asChild>{el}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{label}{count > 0 ? ` (${count})` : ''}</TooltipContent>
    </Tooltip>
  )
}

/** Shared by the desktop sidebar and the mobile drawer. */
export function SidebarBody({ variant, collapsed = false, onNavigate }: { variant: 'desktop' | 'drawer'; collapsed?: boolean; onNavigate?: () => void }) {
  const t = useT()
  const { pathname } = useLocation()
  const openCount = useAudit((s) => s.findings.filter((f) => f.status === 'open').length)
  const toggleSidebar = useUI((s) => s.toggleSidebar)
  const openAssistant = useUI((s) => s.openAssistant)
  const done = () => onNavigate?.()

  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={done} aria-label={`TSICL ${t('Audit Assistant')}`} className={cn('flex items-center gap-3 rounded-xl px-5 pt-5 pb-4', collapsed && 'justify-center px-0')}>
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-foreground/10">
          <img src="/tripura-govt-logo.png" alt="Government of Tripura" className="size-8 object-contain" />
        </span>
        {!collapsed && (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold tracking-tight">TSICL</span>
            <span className="block truncate text-xs text-muted-foreground">{t('Audit Assistant')}</span>
          </span>
        )}
      </Link>

      <nav data-tour="nav" aria-label={t('Main')} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && (collapsed ? 'mt-3 border-t border-sidebar-border pt-3' : 'mt-5'))}>
            {group.label && !collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{t(group.label)}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavRow key={item.label} item={item} collapsed={collapsed} pillId={`pill-${variant}`}
                  active={!!item.to && isActive(item.to, pathname)}
                  count={item.badge === 'findings' ? openCount : 0}
                  onClick={() => { done(); if (item.action === 'assistant') openAssistant() }} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('flex items-center gap-1 border-t border-sidebar-border p-3', collapsed && 'flex-col')}>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-semibold text-background', !collapsed && 'mr-2')} aria-hidden>CA</span>
        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium">CA Firm</span>
            <span className="block truncate text-xs text-muted-foreground">{t('Appointed Auditor')}</span>
          </span>
        )}
        <IconBtn label={t('Take the tour')} onClick={() => { done(); startTour() }} className="size-9"><Compass /></IconBtn>
        {variant === 'desktop' && (
          <IconBtn label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} onClick={toggleSidebar} className="size-9">
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconBtn>
        )}
      </div>
    </div>
  )
}
