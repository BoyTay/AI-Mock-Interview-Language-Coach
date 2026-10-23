import { Sparkles } from 'lucide-react'
import Badge from '@/components/common/Badge'
import { cn } from '@/lib/utils'

export default function Transcript({ messages }) {
  return (
    <div
      role="log"
      aria-label="Live transcript"
      className="flex max-h-[520px] min-h-[340px] flex-[1_1_auto] flex-col gap-[18px] overflow-y-auto p-5"
    >
      {messages.map((m, i) =>
        m.from === 'ai' ? (
          <article key={i} className="flex max-w-[86%] items-start gap-2.5">
            <div className="flex size-[30px] flex-none items-center justify-center rounded-lg bg-indigo-900">
              <Sparkles className="size-[15px] text-indigo-200" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div
                className={cn(
                  'rounded-[4px_14px_14px_14px] bg-slate-800 px-3.5 py-3 text-sm leading-[1.55] text-slate-200',
                  m.followUp && 'border border-indigo-600',
                )}
              >
                {m.text}
              </div>
              <div className="flex items-center gap-2.5">
                {m.followUp && <Badge tone="s">Follow-up</Badge>}
                <span className="font-mono text-[11px] text-slate-400">{m.meta}</span>
              </div>
            </div>
          </article>
        ) : (
          <article key={i} className="flex justify-end">
            <div className="flex max-w-[86%] flex-col items-end gap-1">
              <div className="rounded-[14px_4px_14px_14px] bg-indigo-600 px-3.5 py-3 text-sm leading-[1.55] text-white">
                {m.text}
              </div>
              <span className="font-mono text-[11px] text-slate-400">{m.meta}</span>
            </div>
          </article>
        ),
      )}
    </div>
  )
}
