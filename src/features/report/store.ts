// Report session state, kept outside the page so generation and sign-off survive navigating away and back.
import { create } from 'zustand'
import { TODAY, useAudit } from '@/data/store'
import { play } from '@/lib/sound'
import { askSummary, buildStats, fallbackSummary, plural } from './summary'

interface ReportState {
  phase: 'idle' | 'working' | 'ready'
  summary: string
  approvedAt?: string
  generate: () => Promise<void>
  approve: () => void
}

const GEN_MS = 3000 // the staged animation; the AI call is capped at 6s inside askSummary, then the offline text takes over

export const useReport = create<ReportState>()((set, get) => ({
  phase: 'idle',
  summary: '',
  generate: async () => {
    if (get().phase === 'working') return
    set({ phase: 'working', approvedAt: undefined })
    const stats = buildStats(useAudit.getState())
    const [, ai] = await Promise.all([new Promise((r) => setTimeout(r, GEN_MS)), askSummary(stats)])
    set({ phase: 'ready', summary: ai?.trim() || fallbackSummary(stats) })
    useAudit.getState().log('report', `Q2 report drafted from ${plural(stats.reported, 'finding')}`)
    play('success')
  },
  approve: () => {
    set({ approvedAt: TODAY })
    useAudit.getState().log('report', 'Auditor approved and signed the Q2 report')
    play('complete')
  },
}))
