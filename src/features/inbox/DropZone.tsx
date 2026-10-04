// Drag-and-drop / choose-files zone. Reads only name, size and type; nothing leaves the browser.
import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { BorderBeam } from '@/components/ui/border-beam'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const t = useT()
  const [over, setOver] = useState(false)
  const depth = useRef(0) // dragenter/leave fire for every child element; count them
  const take = (list: FileList | null) => list && onFiles(Array.from(list))
  return (
    <label
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); depth.current = 0; setOver(false); take(e.dataTransfer.files) }}
      className={cn(
        'relative flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-center transition-[border-color,background-color,transform] duration-200 hover:border-foreground/25 hover:bg-muted/40 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 active:scale-[0.995]',
        over && 'border-ai/60 bg-ai/[0.05]',
      )}
    >
      <input type="file" multiple className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      <span className={cn('grid size-10 place-items-center rounded-full bg-muted text-muted-foreground transition-colors duration-200', over && 'bg-ai/10 text-ai')}>
        <UploadCloud className="size-5" aria-hidden />
      </span>
      <span className="text-[15px] font-medium text-foreground">{over ? t('Drop to let the assistant read them') : t('Drop files here')}</span>
      <span className="max-w-[26ch] text-[13px] text-muted-foreground">{t('or click to choose. Any type: PDF, scan, photo or spreadsheet.')}</span>
      <span className="mt-1 text-xs text-muted-foreground/80">{t('Demo only: just the file name, size and type are read. Nothing is uploaded.')}</span>
      {over && <BorderBeam size={90} duration={3} colorFrom="#8b6cf6" colorTo="#c4b5fd" borderWidth={1.5} />}
    </label>
  )
}
