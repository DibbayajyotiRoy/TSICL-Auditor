import { Menu, Search, Sparkles } from 'lucide-react'
import { useUI, type Lang } from '@/lib/ui'
import { useT } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { IconBtn } from './controls'
import { MOD } from './nav'
import MoreMenu from './MoreMenu'

const LANGS: { code: Lang; short: string; full: string }[] = [
  { code: 'en', short: 'EN', full: 'English' },
  { code: 'bn', short: 'বাং', full: 'বাংলা' },
  { code: 'hi', short: 'हिं', full: 'हिन्दी' },
]
const ORDER: Lang[] = ['en', 'bn', 'hi']

function LangSwitcher() {
  const t = useT()
  const lang = useUI((s) => s.lang)
  const setLang = useUI((s) => s.setLang)
  const pick = (l: Lang) => { setLang(l); play('toggle') }
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]
  const cycle = () => { pick(ORDER[(ORDER.indexOf(lang) + 1) % ORDER.length]) }

  return (
    <>
      <div role="group" aria-label={t('Language')}
        className="hidden h-10 items-center overflow-hidden rounded-xl border border-border bg-card text-muted-foreground sm:inline-flex">
        {LANGS.map((l) => {
          const active = l.code === lang
          return (
            <button key={l.code} type="button" title={l.full} aria-label={l.full} aria-pressed={active}
              onClick={() => pick(l.code)}
              className={`inline-flex h-10 min-w-10 items-center justify-center px-2 text-[13px] font-medium transition-colors duration-150 hover:text-foreground ${active ? 'bg-muted text-foreground' : ''}`}>
              {l.short}
            </button>
          )
        })}
      </div>
      <button type="button" onClick={cycle} title={`${t('Language')}: ${current.full}`} aria-label={`${t('Language')}: ${current.full}`}
        className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-border bg-card px-2 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground sm:hidden">
        {current.short}
      </button>
    </>
  )
}

export default function TopBar() {
  const t = useT()
  const setPaletteOpen = useUI((s) => s.setPaletteOpen)
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen)
  const openAssistant = useUI((s) => s.openAssistant)
  const openPalette = () => { setPaletteOpen(true); play('open') }

  return (
    <header data-shell className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-2 px-4 sm:px-6 lg:px-10">
        <IconBtn label={t('Open menu')} onClick={() => setMobileNavOpen(true)} className="-ml-2 lg:hidden"><Menu /></IconBtn>

        <button type="button" data-tour="search" onClick={openPalette}
          className="group hidden h-10 min-w-0 max-w-md flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3.5 text-left text-[14px] text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] duration-150 hover:border-foreground/20 hover:shadow-[0_2px_8px_-4px_rgb(0_0_0/0.15)] md:flex">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t('Search or ask anything…')}</span>
          <kbd className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">{MOD}K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <IconBtn label={t('Search or ask anything…')} data-tour="search" onClick={openPalette} className="md:hidden"><Search /></IconBtn>
          <span className="hidden h-7 items-center rounded-full bg-muted px-2.5 text-[11px] font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase ring-1 ring-border ring-inset min-[440px]:inline-flex">
            {t('Demo data')}<span className="hidden sm:inline">&nbsp;· Q2 FY 2026-27</span>
          </span>
          <button type="button" data-tour="ask-ai" onClick={() => openAssistant()} aria-label={t('Ask AI')}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ai/10 px-3 text-[14px] font-medium text-ai ring-1 ring-ai/25 transition-[background-color,transform] duration-150 ease-out hover:bg-ai/15 active:scale-[0.97] sm:px-4">
            <Sparkles className="size-4" aria-hidden /><span className="hidden min-[400px]:inline">{t('Ask AI')}</span>
          </button>
          <LangSwitcher />
          <MoreMenu />
        </div>
      </div>
    </header>
  )
}
