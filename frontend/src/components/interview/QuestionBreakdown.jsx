import { Play, Plus } from 'lucide-react'
import { useState } from 'react'
import Accordion from '@/components/common/Accordion'
import Badge from '@/components/common/Badge'
import Caption from '@/components/common/Caption'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'
import { scoreTone } from '@/utils/tone'
import Chip from './Chip'

const HIGHLIGHT = {
  r: 'border-b-2 border-rose-500 bg-rose-500/[.18]',
  a: 'border-b-2 border-amber-500 bg-amber-500/20',
  g: 'border-b-2 border-emerald-500 bg-emerald-500/[.18]',
  c: 'rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[12.5px] text-indigo-200',
}

function Fragments({ parts }) {
  return (
    <p className="m-0 text-sm leading-[1.75] text-slate-300">
      {parts.map((p, i) => (
        <span key={i} className={cn(HIGHLIGHT[p.h])}>
          {p.t}
        </span>
      ))}
    </p>
  )
}

// Static, deterministic bars: 17 of 48 are "played".
function RecordedPlayer({ duration }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const h = 4 + Math.abs(Math.sin(i * 0.9) * 8 + Math.sin(i * 0.37) * 6)
    return { x: 2 + i * 5, y1: 16 - h, y2: 16 + h, played: i < 17 }
  })

  return (
    <div className="flex items-center gap-3.5 rounded-[10px] border border-slate-800 bg-slate-950 px-3.5 py-2.5">
      <button
        type="button"
        aria-label="Play recording"
        className="flex size-10 flex-none items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
      >
        <Play className="size-4" fill="currentColor" aria-hidden="true" />
      </button>
      <svg viewBox="0 0 240 32" preserveAspectRatio="none" className="block h-8 min-w-20 flex-1" aria-hidden="true">
        {bars.map((b) => (
          <path
            key={b.x}
            d={`M${b.x} ${b.y1.toFixed(1)} V${b.y2.toFixed(1)}`}
            stroke={b.played ? '#818cf8' : '#475569'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <span className="whitespace-nowrap font-mono text-xs text-slate-400">0:00 / {duration}</span>
      <span className="rounded-[5px] border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-300">
        1x
      </span>
    </div>
  )
}

export default function QuestionBreakdown({ questions }) {
  // Index of the open question; -1 means all closed. Q4 starts open, as in the design.
  const [openIndex, setOpenIndex] = useState(3)

  return (
    <section aria-label="Question breakdown" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-50">Question-by-question breakdown</h2>
        <span className="text-[13px] text-slate-400">Select a question to expand it</span>
      </div>

      {questions.map((q, i) => {
        const open = openIndex === i
        return (
          <Card key={q.n} className="overflow-hidden">
            <Accordion
              id={`q${q.n}`}
              open={open}
              onToggle={() => setOpenIndex(open ? -1 : i)}
              header={
                <>
                  <span className="w-8 flex-none font-mono text-[13px] font-semibold text-indigo-300">Q{q.n}</span>
                  <span className="min-w-0 flex-[1_1_280px] text-sm font-medium leading-[1.45] text-slate-100">{q.title}</span>
                  <Chip>{q.topic}</Chip>
                  <Badge tone={scoreTone(q.sc)}>{q.sc} / 100</Badge>
                </>
              }
            >
              <div className="flex flex-col gap-5 px-5 pb-[22px] pt-[18px]">
                <div className="flex flex-col gap-2">
                  <Caption>Your recorded answer</Caption>
                  <RecordedPlayer duration={q.dur} />
                </div>

                <div className="flex flex-col gap-2">
                  <Caption>AI critique</Caption>
                  <div className="flex flex-wrap gap-2">
                    {q.tags.map((t) => (
                      <Badge key={t.text} tone={t.tone}>
                        {t.text}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5 rounded-[10px] border border-slate-800 bg-slate-950 p-4">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
                      <i className="block size-2 rounded-full bg-amber-500" />
                      Your Answer
                    </span>
                    <Fragments parts={q.user} />
                  </div>
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5 rounded-[10px] border border-emerald-500/30 bg-[#0b1a17] p-4">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-emerald-300">
                      <i className="block size-2 rounded-full bg-emerald-500" />
                      Optimal Reference Answer
                    </span>
                    <Fragments parts={q.ref} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    Highlights: amber and red mark gaps in your answer, green marks key points to include.
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-indigo-600 bg-indigo-600/[.14] px-4 text-[13px] font-semibold text-indigo-200 hover:bg-indigo-600/[.28]"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add to Mistake Flashcards
                  </button>
                </div>
              </div>
            </Accordion>
          </Card>
        )
      })}
    </section>
  )
}
