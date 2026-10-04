// The "•••" menu: everything that is not needed every minute (AI engine, sound, theme, tour, reset).
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Compass, Ellipsis, Moon, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI } from '@/lib/ui'
import { useAudit } from '@/data/store'
import { useT } from '@/lib/i18n'
import { play } from '@/lib/sound'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconBtn } from './controls'
import { startTour } from './nav'

const keepOpen = (e: Event) => e.preventDefault()
const item = 'min-h-10 gap-3 rounded-lg px-2.5 text-[14px]'
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

export default function MoreMenu() {
  const t = useT()
  const { resolvedTheme, setTheme } = useTheme()
  const { demoMode, setDemoMode, soundOn, toggleSound } = useUI()
  const lastReset = useAudit((s) => s.lastReset)
  const dark = resolvedTheme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconBtn label={t('More options')}>
          <Ellipsis />
          {!demoMode && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-ai ring-2 ring-background" aria-hidden />}
        </IconBtn>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[300px] rounded-xl p-1.5 shadow-lg">
        <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1">{t('AI engine')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={demoMode ? 'demo' : 'live'} onValueChange={(v) => { setDemoMode(v === 'demo'); play('toggle') }}>
          <DropdownMenuRadioItem value="demo" onSelect={keepOpen} className={cn(item, 'items-start py-2')}>
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            <span><span className="block">{t('Demo mode (deterministic)')}</span><span className="block text-xs text-muted-foreground">{t('Same answers every time. Safe for live demos.')}</span></span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="live" onSelect={keepOpen} className={cn(item, 'items-start py-2')}>
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ai" aria-hidden />
            <span><span className="block">{t('Live AI')}</span><span className="block text-xs text-muted-foreground">{t('Asks Claude. Falls back to demo answers if offline.')}</span></span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={soundOn} onCheckedChange={() => { toggleSound(); play('toggle') }} onSelect={keepOpen} className={item}>
          {soundOn ? <Volume2 /> : <VolumeX />}{t('Sound effects')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={dark} onCheckedChange={(v) => { setTheme(v ? 'dark' : 'light'); play('toggle') }} onSelect={keepOpen} className={item}>
          <Moon />{t('Dark mode')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={startTour} className={item}><Compass />{t('Take the tour')}</DropdownMenuItem>
        <DropdownMenuItem className={cn(item, 'items-start py-2')}
          onSelect={() => { useAudit.getState().resetDemo(); toast.success(t('Demo reset'), { description: t('Back to the starting data.') }); play('success') }}>
          <RotateCcw className="mt-0.5" />
          <span><span className="block">{t('Reset demo')}</span><span className="block text-xs text-muted-foreground">{t('Last reset')} {time(lastReset)}</span></span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
