import { ArrowRight, Check } from 'lucide-react'
import { Fragment, useState } from 'react'
import Badge from '@/components/common/Badge'
import { cn } from '@/lib/utils'
import { diffWords } from '@/utils/diff'

// The wrong words struck through in rose and the words that replace them in green.
function Diff({ mistake }) {
  return diffWords(mistake.w, mistake.f).map((run, i) => (
    <Fragment key={i}>
      {i > 0 && ' '}
      {run.type === 'same' && run.text}
      {run.type === 'del' && <s className="text-rose-300 decoration-[1.5px]">{run.text}</s>}
      {run.type === 'add' && <b className="font-semibold text-emerald-400">{run.text}</b>}
    </Fragment>
  ))
}

export default function ErrorCorrection({ segments, unplaced = [] }) {
  const mistakes = [...segments.filter((s) => s && typeof s === 'object'), ...unplaced]
  const [selectedId, setSelectedId] = useState(mistakes[0]?.id)
  const current = mistakes.find((m) => m.id === selectedId) ?? mistakes[0]

  if (!current) {
    return (
      <div className="flex flex-col gap-[18px] p-5">
        <div className="whitespace-pre-line text-[15px] leading-[2.15] text-slate-200">
          {segments.map((s) => (s === null ? '\n\n' : s)).join('')}
        </div>
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-300"
        >
          <Check className="size-4" aria-hidden="true" />
          No mistakes found
        </div>
      </div>
    )
  }

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
              <Diff mistake={s} />
            </button>
          )
        })}
      </div>

      {unplaced.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs text-slate-400">
            We could not find these sentences in your text, so they are listed here.
          </span>
          <ul aria-label="Mistakes not found in your text" className="m-0 flex list-none flex-col gap-2 p-0">
            {unplaced.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={m.id === current.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    'rounded-[5px] bg-rose-500/20 px-2 py-1 text-left text-sm text-slate-200 hover:bg-rose-500/[.32]',
                    m.id === current.id && 'outline outline-2 outline-offset-1 outline-indigo-400',
                  )}
                >
                  <Diff mistake={m} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
