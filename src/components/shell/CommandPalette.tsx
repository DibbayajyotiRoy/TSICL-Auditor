// ⌘K / Ctrl+K palette: go to a page, run an action, jump to a finding, or hand a question to the AI assistant.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FilePlus2, Play, Sparkles, ShieldAlert, Wand2 } from 'lucide-react'
import { useUI } from '@/lib/ui'
import { useAudit } from '@/data/store'
import { AREA_LABEL, type Severity } from '@/data/types'
import { useT } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { SeverityBadge } from '@/components/kit'
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { PAGES, startTour } from './nav'

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export default function CommandPalette() {
  const t = useT()
  const navigate = useNavigate()
  const open = useUI((s) => s.paletteOpen)
  const setOpen = useUI((s) => s.setPaletteOpen)
  const openAssistant = useUI((s) => s.openAssistant)
  const findings = useAudit((s) => s.findings)
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUI.getState().setPaletteOpen(!useUI.getState().paletteOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (!open) setQ('') }, [open])

  const text = q.trim()
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean)
  const hit = (hay: string) => terms.every((w) => hay.toLowerCase().includes(w))
  const run = (fn: () => void) => () => { setOpen(false); fn() }

  const actions = [
    { id: 'audit', label: 'Run full audit', icon: Play, fn: () => { useAudit.getState().rerunAudit(); toast.success(t('Audit complete'), { description: `${useAudit.getState().findings.length} ${t('findings across all active checks')}` }) } },
    { id: 'report', label: 'Generate quarterly report', icon: FilePlus2, fn: () => navigate('/report') },
    { id: 'ask', label: 'Ask AI', icon: Sparkles, fn: () => openAssistant() },
    { id: 'tour', label: 'Start tour', icon: Wand2, fn: startTour },
  ]
  const pages = PAGES.filter((p) => hit(`${p.label} ${t(p.label)}`))
  const acts = actions.filter((a) => hit(`${a.label} ${t(a.label)}`))
  const top = useMemo(
    () => findings.filter((f) => f.status === 'open').sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.amount - a.amount),
    [findings],
  )
  const found = top.filter((f) => hit(`${f.title} ${f.id} ${AREA_LABEL[f.area]} ${f.summary}`)).slice(0, 8)
  const showAsk = !!text && (pages.length + acts.length + found.length === 0 || text.endsWith('?'))

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t('Search or ask anything…')} description={t('Go to a page, run an action or ask the assistant')} className="sm:max-w-xl">
      {/* We filter ourselves (shouldFilter=false) so we know when nothing matched and can offer "Ask AI". */}
      <Command shouldFilter={false} loop className="bg-transparent [&_[data-slot=input-group]]:h-11! [&_[data-slot=command-input]]:text-[15px]">
        <CommandInput value={q} onValueChange={setQ} placeholder={t('Search or ask anything…')} />
        <CommandList className="max-h-[min(420px,60vh)] p-1">
          {showAsk && (
            <CommandGroup>
              <CommandItem value="ask-ai" onSelect={run(() => { openAssistant(text); play('open') })} className="h-11 gap-3">
                <span className="grid size-6 place-items-center rounded-md bg-ai/10 text-ai"><Sparkles className="size-3.5" /></span>
                <span className="min-w-0 truncate">{t('Ask AI')}: “{text}”</span>
              </CommandItem>
            </CommandGroup>
          )}
          {pages.length > 0 && (
            <CommandGroup heading={t('Go to')}>
              {pages.map((p) => (
                <CommandItem key={p.to} value={`go-${p.to}`} onSelect={run(() => navigate(p.to))} className="h-10 gap-3">
                  <p.icon className="text-muted-foreground" />{t(p.label)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {acts.length > 0 && (
            <CommandGroup heading={t('Actions')}>
              {acts.map((a) => (
                <CommandItem key={a.id} value={`act-${a.id}`} onSelect={run(a.fn)} className="h-10 gap-3">
                  <a.icon className="text-muted-foreground" />{t(a.label)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {found.length > 0 && (
            <CommandGroup heading={t('Findings')}>
              {found.map((f) => (
                <CommandItem key={f.id} value={`finding-${f.id}`} onSelect={run(() => navigate(`/findings/${f.id}`))} className="h-11 gap-3">
                  <ShieldAlert className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.title}</span>
                  <SeverityBadge severity={f.severity} className="shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
