import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import Badge from '@/components/common/Badge'
import { cn } from '@/lib/utils'
import { formatMmSs } from '@/utils/time'

function metaFor(message, startedAt, awaiting) {
  const time = formatMmSs((message.at - startedAt) / 1000)
  if (message.from === 'user') return `Text · ${time}`
  const parts = [`Q${message.index}`]
  if (message.followUp) parts.push('follow-up')
  parts.push(time)
  if (awaiting) parts.push('awaiting your answer')
  return parts.join(' · ')
}

export default function Transcript({ messages, startedAt, awaitingAnswer, thinking }) {
  const scroller = useRef(null)

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, thinking])

  return (
    <div
      ref={scroller}
      role="log"
      aria-label="Live transcript"
      className="flex max-h-[520px] min-h-[340px] flex-[1_1_auto] flex-col gap-[18px] overflow-y-auto p-5"
    >
      {messages.map((m, i) => {
        const meta = metaFor(m, startedAt, awaitingAnswer && i === messages.length - 1)
        return m.from === 'ai' ? (
          <article key={i} className="flex max-w-[86%] items-start gap-2.5">
            <div className="flex size-[30px] flex-none items-center justify-center rounded-lg bg-indigo-900">
              <Sparkles className="size-[15px] text-indigo-200" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div
                className={cn(
                  'whitespace-pre-wrap rounded-[4px_14px_14px_14px] bg-slate-800 px-3.5 py-3 text-sm leading-[1.55] text-slate-200',
                  m.followUp && 'border border-indigo-600',
                )}
              >
                {m.text}
              </div>
              <div className="flex items-center gap-2.5">
                {m.followUp && <Badge tone="s">Follow-up</Badge>}
                <span className="font-mono text-[11px] text-slate-400">{meta}</span>
              </div>
            </div>
          </article>
        ) : (
          <article key={i} className="flex justify-end">
            <div className="flex min-w-0 max-w-[86%] flex-col items-end gap-1">
              <div className="whitespace-pre-wrap break-words rounded-[14px_4px_14px_14px] bg-indigo-600 px-3.5 py-3 text-sm leading-[1.55] text-white">
                {m.text}
              </div>
              <span className="font-mono text-[11px] text-slate-400">{meta}</span>
            </div>
          </article>
        )
      })}
      {thinking && (
        <div role="status" className="flex items-center gap-2.5 text-[13px] text-slate-400">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <i
                key={n}
                className="block size-1.5 rounded-full bg-indigo-300 motion-safe:animate-[blink_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: `${n * 0.2}s` }}
              />
            ))}
          </span>
          The AI is thinking about your answer…
        </div>
      )}
    </div>
  )
}
