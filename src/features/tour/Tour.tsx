import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver, type DriveStep } from 'driver.js'
import { tr } from '@/lib/i18n'
import './tour.css'

// first anchor that is actually on screen (hidden / off-canvas sidebars are skipped)
const el = (sel: string) => [...document.querySelectorAll(sel)].find((e) => {
  const r = e.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth
})

const STEPS: { anchor?: string; title: string; text: string; side?: 'right' | 'bottom' | 'left' | 'top' }[] = [
  { anchor: 'nav', side: 'right', title: 'Everything in one place', text: 'Jump between documents, requests, findings and the report from here. The numbers show what needs you.' },
  { anchor: 'search', side: 'bottom', title: 'Search or ask anything', text: 'Find a finding, a vendor or a document, or just type a question in plain words.' },
  { anchor: 'ask-ai', side: 'bottom', title: 'Your AI assistant', text: 'Ask things like "What is overdue?". Every answer shows its evidence, and you always make the final call.' },
  { anchor: 'attention', side: 'top', title: 'This is your to-do list', text: 'The assistant puts the most urgent issues first. Open one to see the evidence and decide.' },
  { anchor: 'kpis', side: 'bottom', title: 'The big picture', text: 'Four numbers that show how the quarter is going, at a glance.' },
  { title: "You're all set", text: 'AI drafts. The auditor decides. You can take this tour again any time from the top bar.' },
]

function start() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const steps: DriveStep[] = STEPS.filter((s) => !s.anchor || el(`[data-tour="${s.anchor}"]`)).map((s) => ({
    element: s.anchor ? () => el(`[data-tour="${s.anchor}"]`)! : undefined,
    popover: { title: tr(s.title), description: tr(s.text), side: s.side, align: 'start' },
  }))
  const d = driver({
    steps,
    popoverClass: 'tsicl-tour',
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: tr('Next'),
    prevBtnText: tr('Back'),
    doneBtnText: tr('Done'),
    closeBtnLabel: tr('Close tour'),
    overlayColor: '#0a0a14',
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 16,
    animate: !reduce,
    smoothScroll: !reduce,
  })
  d.drive()
}

export default function Tour() {
  const navigate = useNavigate()

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    // Opt-in only (top-bar "Take the tour"). Anchors live on the Today page; give the lazy route a moment to mount.
    const run = () => {
      if (document.querySelector('.driver-popover')) return
      if (window.location.pathname !== '/') { navigate('/'); clearTimeout(t); t = setTimeout(start, 700) } else start()
    }
    window.addEventListener('start-tour', run)
    return () => { clearTimeout(t); window.removeEventListener('start-tour', run) }
  }, [])

  return null
}
