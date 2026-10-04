// Small shared pieces for the sidebar and top bar.
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** 40px square ghost button. `label` is the accessible name and tooltip. */
export function IconBtn({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...props}
      className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] aria-expanded:bg-muted aria-expanded:text-foreground [&_svg]:size-[18px]', className)}>
      {children}
    </button>
  )
}

/** "TSICL" monogram: a bold T on a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path d="M9.5 10.5h13M16 10.5V22" className="stroke-background" strokeWidth="2.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}
