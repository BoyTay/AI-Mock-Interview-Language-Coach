import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import Badge from '@/components/common/Badge'
import { cn } from '@/lib/utils'

export default function ErrorCorrection({ segments }) {
  const mistakes = segments.filter((s) => s && typeof s === 'object')
  const [selectedId, setSelectedId] = useState(mistakes[0]?.id)
  const current = mistakes.find((m) => m.id === selectedId) ?? mistakes[0]

  return (
    <div className="flex flex-col gap-[18px] p-5">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>Select a highlighted phrase to see why it is wrong.</span>
        <span className="flex items-center gap-1.5">
          <s className="text-rose-300">wrong</s>
          <span className="font-semibold text-emerald-400">correction</span>
        </span>
      </div>

      <div
        role="group"
        aria-label="Essay with highlighted mistakes"
        className="text-pretty text-[15px] leading-[2.15] text-slate-200"
      >
        {segments.map((s, i) => {
          if (s === null) return <span key={`t${i}`} className="block h-3.5" />
          if (typeof s === 'string') return <span key={`t${i}`}>{s}</span>
          return (
            <button
              key={`e${s.id}`}
              type="button"
              aria-pressed={s.id === current.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                'mx-px inline rounded-[5px] bg-rose-500/20 px-[5px] py-0.5 text-inherit hover:bg-rose-500/[.32]',
                s.id === current.id && 'outline outline-2 outline-offset-1 outline-indigo-400',
              )}
            >
              <s className="text-rose-300 decoration-[1.5px]">{s.w}</s>
              <b className="ml-1.5 font-semibold text-emerald-400">{s.f}</b>
            </button>
          )
        })}
      </div>

      <div
        role="region"
        aria-label="Mistake explanation"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-xl border border-indigo-600 bg-slate-950 p-[18px]"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone={current.k === 'Grammar' ? 'r' : 's'}>{current.k}</Badge>
          <span className="text-[15px] font-semibold text-slate-50">{current.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-sm font-medium">
          <span className="rounded-[5px] bg-rose-500/20 px-2 py-[3px] text-rose-300 line-through">{current.w}</span>
          <ArrowRight className="size-4 text-slate-400" aria-hidden="true" />
          <span className="rounded-[5px] bg-emerald-500/[.14] px-2 py-[3px] text-emerald-400">{current.f}</span>
        </div>
        <p className="m-0 text-sm leading-[1.6] text-slate-300">{current.why}</p>
        <div>
          <button
            type="button"
            className="inline-flex h-[38px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-indigo-600 bg-indigo-600/[.14] px-3.5 text-[13px] font-semibold text-indigo-200 hover:bg-indigo-600/[.28]"
          >
            + Save to Flashcards
          </button>
        </div>
      </div>
    </div>
  )
}
