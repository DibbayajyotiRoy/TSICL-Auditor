import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Card with an animated expand/collapse body. */
export function Disclosure({ title, openTitle = title, icon, defaultOpen = false, tour, children }: {
  title: string; openTitle?: string; icon: ReactNode; defaultOpen?: boolean; tour?: string; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const reduce = useReducedMotion()
  return (
    <section data-tour={tour} className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-[14px] font-medium text-foreground transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2">
        <span className="text-muted-foreground [&>svg]:size-4" aria-hidden>{icon}</span>
        <span className="flex-1">{open ? openTitle : title}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-200 ease-out', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }} className="overflow-hidden">
            <div className="border-t border-border p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
