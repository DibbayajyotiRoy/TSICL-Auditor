import { Suspense, lazy, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { MotionConfig, motion } from 'motion/react'
import { useUI } from '@/lib/ui'
import { useT } from '@/lib/i18n'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import Tour from '@/features/tour/Tour'
import { SidebarBody } from './Sidebar'
import TopBar from './TopBar'
import CommandPalette from './CommandPalette'
import { PAGES, isActive } from './nav'

// Slide-over: lazy so thinking-orbs / voice-glow / bot-avatars canvas code
// stays out of the initial chunk. Null fallback is invisible (it opens as an overlay).
const Assistant = lazy(() => import('@/features/assistant/Assistant'))

function Shell() {
  const t = useT()
  const { pathname } = useLocation()
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const mobileNavOpen = useUI((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen)
  // Animate between pages, not between /findings and /findings/F-12 (keeps the list mounted while J/K navigating).
  const page = pathname.split('/')[1] ?? ''

  useEffect(() => { window.scrollTo(0, 0) }, [page])
  useEffect(() => {
    const here = PAGES.find((p) => isActive(p.to, pathname))
    document.title = `${here ? t(here.label) + ' · ' : ''}TSICL Audit Assistant`
  }, [pathname, t])

  return (
    <div className="flex min-h-svh">
      <aside data-shell className="sticky top-0 hidden h-svh shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:block"
        style={{ width: collapsed ? 72 : 272 }}>
        <SidebarBody variant="desktop" collapsed={collapsed} />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" data-shell showCloseButton={false} className="w-[288px] max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 sm:max-w-[288px]">
          <SheetTitle className="sr-only">{t('Menu')}</SheetTitle>
          <SheetDescription className="sr-only">{t('Go to a page')}</SheetDescription>
          <SidebarBody variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <a href="#main" data-shell className="sr-only z-50 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{t('Skip to content')}</a>
        <TopBar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 overflow-x-clip px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <motion.div key={page} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </main>
      </div>

      <CommandPalette />
      <Suspense fallback={null}><Assistant /></Suspense>
      <Tour />
    </div>
  )
}

export default function Layout() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <MotionConfig reducedMotion="user"><Shell /></MotionConfig>
    </ThemeProvider>
  )
}
