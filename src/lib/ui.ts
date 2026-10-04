import { create } from 'zustand'

export type Lang = 'en' | 'bn' | 'hi'
interface UIState {
  assistantOpen: boolean
  assistantPrompt?: string // when set, assistant opens and auto-asks this
  paletteOpen: boolean
  soundOn: boolean
  /** true = deterministic seeded AI outputs (safe for live demos). false = call live Claude via /api/ask. */
  demoMode: boolean
  setDemoMode: (v: boolean) => void
  lang: Lang
  sidebarCollapsed: boolean // desktop sidebar, persisted
  mobileNavOpen: boolean // drawer; the tour can open it
  openAssistant: (prompt?: string) => void
  closeAssistant: () => void
  setPaletteOpen: (v: boolean) => void
  toggleSound: () => void
  setLang: (l: Lang) => void
  toggleSidebar: () => void
  setMobileNavOpen: (v: boolean) => void
}
const saved = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const persist = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export const useUI = create<UIState>()((set) => ({
  assistantOpen: false,
  paletteOpen: false,
  soundOn: saved('sound') === 'on', // default OFF for executive demos
  demoMode: saved('demoMode') !== 'off',
  setDemoMode: (v) => { persist('demoMode', v ? 'on' : 'off'); set({ demoMode: v }) },
  lang: (saved('lang') as Lang) || 'en',
  sidebarCollapsed: saved('sidebar') === 'collapsed',
  mobileNavOpen: false,
  openAssistant: (prompt) => set({ assistantOpen: true, assistantPrompt: prompt }),
  closeAssistant: () => set({ assistantOpen: false, assistantPrompt: undefined }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleSound: () => set((s) => { persist('sound', s.soundOn ? 'off' : 'on'); return { soundOn: !s.soundOn } }),
  setLang: (lang) => { persist('lang', lang); set({ lang }) },
  toggleSidebar: () => set((s) => { persist('sidebar', s.sidebarCollapsed ? 'open' : 'collapsed'); return { sidebarCollapsed: !s.sidebarCollapsed } }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}))
