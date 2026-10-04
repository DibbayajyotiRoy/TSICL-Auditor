// "Physical verification list": printable checklist of unverified assets, grouped by location.
import { createPortal } from 'react-dom'
import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/kit'
import { TODAY } from '@/data/store'
import type { Asset } from '@/data/types'
import { formatDate, formatINR } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { checklistGroups } from './derive'

type Groups = ReturnType<typeof checklistGroups>

function Sheet({ groups, count }: { groups: Groups; count: number }) {
  const t = useT()
  return (
    <div className="text-[12px] leading-snug text-black">
      <h2 className="text-base font-semibold">{t('TSICL Physical Verification Checklist')}</h2>
      <p className="mb-4 mt-0.5 text-neutral-600">
        {t('Generated')} {formatDate(TODAY)} · {count} {t('assets across')} {groups.length} {t('locations')} · {t('Tick each asset when seen, note any damage.')}
      </p>
      {groups.map((g) => (
        <section key={g.loc} className="mb-5">
          <h3 className="mb-1 break-after-avoid border-b border-neutral-800 pb-1 text-[13px] font-semibold">
            {g.loc} <span className="font-normal text-neutral-600">· {g.items.length} {g.items.length === 1 ? t('asset') : t('Assets')}</span>
          </h3>
          <table className="w-full border-collapse">
            <tbody>
              {g.items.map((a: Asset) => (
                <tr key={a.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                  <td className="w-6 py-1.5"><span className="mt-0.5 block size-3.5 border border-neutral-800" /></td>
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono">{a.tag}</td>
                  <td className="py-1.5 pr-3">{a.name}<span className="text-neutral-500"> · {a.category}</span></td>
                  <td className="py-1.5 pr-3 text-neutral-600">{a.assignedTo ?? t('Unassigned')}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">{formatINR(a.cost)}</td>
                  <td className="w-28 py-1.5 text-neutral-400">{t('Remarks')} ________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

export function ChecklistDialog({ open, onOpenChange, assets }: { open: boolean; onOpenChange: (v: boolean) => void; assets: Asset[] }) {
  const t = useT()
  const groups = useMemo(() => checklistGroups(assets), [assets])
  const count = groups.reduce((s, g) => s + g.items.length, 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">{t('Physical verification list')}</DialogTitle>
          <DialogDescription>{t('Hand this to the field team. It lists only what nobody has seen this year, grouped by location.')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-white p-5 text-black">
          {count ? <Sheet groups={groups} count={count} /> : (
            <EmptyState title="Everything has been verified this year" body="There is nothing left to check on site." />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-10 px-4" onClick={() => onOpenChange(false)}>{t('Close')}</Button>
          <Button className="h-10 gap-2 px-4" disabled={!count} onClick={() => window.print()}>
            <Printer /> {t('Print checklist')}
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* ponytail: print = hide everything except this portal, no iframe/new-window plumbing */}
      {open && count > 0 && createPortal(
        <div id="assets-print-sheet" className="hidden bg-white p-8 print:block">
          <style>{'@media print{body>*:not(#assets-print-sheet){display:none!important}html,body{overflow:visible!important;height:auto!important}}'}</style>
          <Sheet groups={groups} count={count} />
        </div>,
        document.body,
      )}
    </Dialog>
  )
}
