// Mail-client style list: one whole-row button per document.
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, Paperclip } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AuditDocument, Division } from '@/data/types'
import { Confidence } from '@/components/kit'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useFlow } from './flow'
import { fmtField, KIND_LABEL } from './model'
import { KindChip, SenderAvatar, StageDots, Working, senderName, timeLabel } from './parts'

export interface IssueInfo { count: number; firstId: string }

function Snippet({ doc }: { doc: AuditDocument }) {
  const t = Object.keys(doc.fields).slice(0, 3).map((k) => fmtField(k, doc.fields[k])).join(' · ')
  return <span className="min-w-0 truncate text-[13px] text-muted-foreground">{t || doc.name}</span>
}

function DocRow({ doc, division, issue, index, first, onOpen }: { doc: AuditDocument; division?: Division; issue?: IssueInfo; index: number; first: boolean; onOpen: () => void }) {
  const t = useT()
  const reduce = useReducedMotion()
  const flight = useFlow((s) => s.stage[doc.id])
  const subject = useFlow((s) => s.subject[doc.id])
  const isSession = useFlow((s) => s.session.includes(doc.id))
  const name = senderName(doc, division)
  const live = flight !== undefined
  const working = live || doc.status === 'processing'
  const stage = flight ?? 1
  const chips = isSession && (flight === undefined || flight >= 3) ? Object.keys(doc.fields).slice(0, 4) : []
  return (
    <motion.li
      layout={reduce ? false : 'position'}
      initial={reduce ? false : { opacity: 0, y: first ? 8 : -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34, delay: first ? Math.min(index, 10) * 0.035 : 0 }}
      className="border-b border-border last:border-b-0"
    >
      <button type="button" onClick={onOpen}
        className="flex min-h-[76px] w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:gap-4 sm:px-5">
        <SenderAvatar doc={doc} name={name} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13px] text-muted-foreground">{t(name)}{division && <span className="text-muted-foreground/70"> · {division.name}</span>}</p>
            <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeLabel(doc, isSession)}</time>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="min-w-0 truncate text-[15px] font-medium text-foreground">{subject ?? doc.name}</p>
            {(live ? stage >= 2 : doc.status !== 'processing') && <KindChip kind={doc.kind} animate={live} className="hidden min-[420px]:inline-flex" />}
            {doc.status === 'needs_review' && !live && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-sev-high/10 px-1.5 text-[11px] font-medium text-sev-high ring-1 ring-inset ring-sev-high/20">
                <AlertTriangle className="size-3" aria-hidden />{t('Needs review')}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 truncate text-[13px] text-muted-foreground">
              {working ? (
                stage === 1 ? <Working label={t('Reading…')} />
                  : stage === 4 ? <Working label={t('Checking…')} variant="check" />
                    : <span className="font-medium text-ai">{stage === 0 ? t('Received') : stage === 2 ? `${t('Sorted as')} ${t(KIND_LABEL[doc.kind]).toLowerCase()}` : t('Details extracted')}</span>
              ) : isSession ? (
                subject && <span className="inline-flex items-center gap-1"><Paperclip className="size-3" aria-hidden />{doc.name}</span>
              ) : <Snippet doc={doc} />}
            </span>
            {working ? <StageDots stage={stage} /> : <Confidence value={doc.confidence} />}
          </div>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((k, i) => (
                <motion.span key={k}
                  initial={reduce || !live ? false : { opacity: 0, y: 4, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.35, delay: i * 0.14, ease: 'easeOut' }}
                  className="max-w-full truncate rounded-md border border-ai/20 bg-ai/[0.06] px-1.5 py-0.5 text-xs text-foreground/80">
                  <span className="text-muted-foreground">{k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}: </span>
                  <span className="font-medium tabular-nums">{fmtField(k, doc.fields[k])}</span>
                </motion.span>
              ))}
            </div>
          )}
        </div>
      </button>
      {issue && !live && (
        <motion.div initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }} className="pb-3 pl-[64px] pr-4 sm:pl-[72px] sm:pr-5">
          <Link to={`/findings/${issue.firstId}`} className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-sev-high/10 px-2.5 text-[13px] font-medium text-sev-high ring-1 ring-inset ring-sev-high/20 transition-colors hover:bg-sev-high/15')}>
            <AlertTriangle className="size-3.5" aria-hidden />
            {issue.count === 1 ? t('1 issue found') : `${issue.count} ${t('issues found')}`}
            <span aria-hidden>→</span> {t('View finding')}
          </Link>
        </motion.div>
      )}
    </motion.li>
  )
}

export function DocList({ docs, divisions, issues, first, onOpen }: { docs: AuditDocument[]; divisions: Division[]; issues: Map<string, IssueInfo>; first: boolean; onOpen: (id: string) => void }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-card">
      {docs.map((d, i) => (
        <DocRow key={d.id} doc={d} index={i} first={first} division={divisions.find((x) => x.id === d.divisionId)} issue={issues.get(d.id)} onOpen={() => onOpen(d.id)} />
      ))}
    </ul>
  )
}
