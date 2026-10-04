// Semantic UI sounds via vendored sensory-ui (MIT, see ./sensory/LICENSE).
// play() works outside React (store actions call it): a tiny inner component hands the
// provider's playSound to a module-level ref. Safe to import under node (no top-level browser access).
import { useEffect, type ReactNode } from 'react'
import { SensoryUIProvider, useSensoryUI } from './sensory/config/provider'
import type { SoundRole as SensoryRole } from './sensory/config/sound-roles'
import { useUI } from './ui'

export type SoundRole = 'tap' | 'toggle' | 'confirm' | 'success' | 'error' | 'warning' | 'notify' | 'open' | 'close' | 'complete'

const ROLE: Record<SoundRole, SensoryRole> = {
  tap: 'interaction.tap',
  toggle: 'interaction.toggle',
  confirm: 'interaction.confirm',
  success: 'notification.success',
  error: 'notification.error',
  warning: 'notification.warning',
  notify: 'notification.info',
  open: 'overlay.open',
  close: 'overlay.close',
  complete: 'hero.complete',
}

let engine: ReturnType<typeof useSensoryUI>['playSound'] | null = null

export function play(role: SoundRole) {
  if (!engine || !useUI.getState().soundOn) return
  void engine(ROLE[role])
}

function Bridge() {
  const { playSound } = useSensoryUI()
  useEffect(() => {
    engine = playSound
    return () => { if (engine === playSound) engine = null }
  }, [playSound])
  return null
}

const CONFIG = {
  theme: 'crisp',
  volume: 0.3,
  categories: { interaction: true, overlay: true, navigation: true, notification: true, hero: true },
}

export function SoundProvider({ children }: { children: ReactNode }) {
  return (
    <SensoryUIProvider config={CONFIG}>
      <Bridge />
      {children}
    </SensoryUIProvider>
  )
}
