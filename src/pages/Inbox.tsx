import { useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Mail } from 'lucide-react'
import { Confidence, EmptyState, PageHeader } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { useAudit } from '@/data/store'
import { DocList } from '@/features/inbox/DocList'
import { DocPreview } from '@/features/inbox/DocPreview'
import { DropZone } from '@/features/inbox/DropZone'
import { Pipeline } from '@/features/inbox/Pipeline'
import { confirmDocument, ingestFiles, simulateEmail } from '@/features/inbox/flow'
import { fieldRows } from '@/features/inbox/model'
import { KindChip, senderName } from '@/features/inbox/parts'
import { useT, tr } from '@/lib/i18n'
import { play } from '@/lib/sound'
import { cn } from '@/lib/utils'

export default function Inbox() {
  const t = useT()
  const documents = useAudit((s) => s.documents)
  const divisions = useAudit((s) => s.divisions)
  const findings = useAudit((s) => s.findings)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [active, setActive] = useState<string | undefined>(undefined)
  const [first, setFirst] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setFirst(false), 800)
    return () => clearTimeout(t)
  }, [])

  // Which findings point at each document, so list rows can link to them.
  const issues = useMemo(() => {
    const m = new Map<string, { count: number; firstId: string }>()
    for (const f of findings) {
      for (const e of f.evidence) {
        if (!e.docId) continue
        const cur = m.get(e.docId)
        if (cur) cur.count += 1
        else m.set(e.docId, { count: 1, firstId: f.id })
      }
    }
    return m
  }, [findings])

  const selected = documents.find((d) => d.id === selectedId) ?? documents[0]
  useEffect(() => { setActive(undefined) }, [selected?.id])

  const rows = useMemo(() => (selected ? fieldRows(selected) : []), [selected])
  const division = divisions.find((d) => d.id === selected?.divisionId)
  const flags = useMemo(() => {
    const f: Record<string, 'blurry' | 'missing'> = {}
    for (const r of rows) if (r.flag) f[r.key] = r.flag
    return f
  }, [rows])
  const flaggedCount = rows.filter((r) => r.flag).length
  const reading = selected?.status === 'processing'

  const onConfirm = () => {
    if (!selected) return
    confirmDocument(selected, rows.map((r) => r.key))
    play('confirm')
    toast.success(tr('Details confirmed'), { description: `${selected.name} ${tr('is filed and ready for the audit.')}` })
  }

  return (
    <MotionConfig reducedMotion="user">
      <PageHeader
        title="Document Inbox"
        subtitle="Bills, orders and receipts land here. The assistant reads each one and pulls out the details — you just check them and confirm."
        actions={
          <Button className="h-10 px-4" onClick={() => simulateEmail(divisions)}>
            <Mail aria-hidden />{t('Simulate incoming email')}
          </Button>
        }
      />

      <div className="min-w-0 space-y-6">
        <Pipeline docs={documents} />
        <DropZone onFiles={(files) => ingestFiles(files, divisions)} />

        {documents.length === 0 ? (
          <EmptyState
            title={t('No documents yet')}
            body={t('New bills and orders will appear here when departments send them. Try one now to see how it works.')}
            action={
              <Button className="h-10 px-4" onClick={() => simulateEmail(divisions)}>
                <Mail aria-hidden />{t('Simulate incoming email')}
              </Button>
            }
          />
        ) : (
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
            <section aria-label={t('Documents')} className="min-w-0">
              <DocList docs={documents} divisions={divisions} issues={issues} first={first} onOpen={setSelectedId} />
            </section>
            {selected && (
              <aside aria-label={t('Document details')} className="min-w-0 lg:sticky lg:top-6">
                <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-muted-foreground">
                      {t(senderName(selected, division))}{division && <span> · {division.name}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-[17px] font-semibold text-foreground">{selected.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <KindChip kind={selected.kind} />
                      <Confidence value={selected.confidence} />
                    </div>
                  </div>

                  {selected.status === 'needs_review' && (
                    <p className="flex items-start gap-2 rounded-xl bg-sev-high/10 px-3 py-2.5 text-[13px] leading-relaxed text-foreground ring-1 ring-inset ring-sev-high/20">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sev-high" aria-hidden />
                      {t('Please check')} {flaggedCount > 0 ? <>{t('the')} {flaggedCount} {t('marked')} {t(flaggedCount === 1 ? 'field' : 'fields')} {t('below')} </> : <>{t('the details below')} </>}{t('before confirming — the reading may be slightly off.')}
                    </p>
                  )}

                  {reading ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t('The assistant is still reading this document — the details will appear here in a moment.')}
                    </p>
                  ) : (
                    <ul aria-label={t('Details pulled out')} className="overflow-hidden rounded-xl border border-border">
                      {rows.map((r) => (
                        <li key={r.key} className="border-b border-border last:border-b-0">
                          <button
                            type="button"
                            aria-pressed={active === r.key}
                            onMouseEnter={() => setActive(r.key)}
                            onMouseLeave={() => setActive(undefined)}
                            onFocus={() => setActive(r.key)}
                            onBlur={() => setActive(undefined)}
                            onClick={() => setActive(active === r.key ? undefined : r.key)}
                            className={cn(
                              'flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-muted/50',
                              active === r.key && 'bg-ai/[0.06]',
                            )}
                          >
                            <span className="flex min-w-0 shrink-0 items-center gap-1.5">
                              <span className="text-muted-foreground">{t(r.label)}</span>
                              {r.flag && (
                                <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-sev-high/10 px-1.5 text-[11px] font-medium text-sev-high ring-1 ring-inset ring-sev-high/20">
                                  {t('Check this')}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 truncate text-right font-medium tabular-nums text-foreground">
                              {r.text || '—'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <DocPreview doc={selected} division={division} flags={flags} active={active} onActive={setActive} />

                  <Button className="h-10 w-full px-4" disabled={reading} onClick={onConfirm}>
                    <CheckCircle2 aria-hidden />{t('Confirm details')}
                  </Button>
                </section>
              </aside>
            )}
          </div>
        )}
      </div>
    </MotionConfig>
  )
}
