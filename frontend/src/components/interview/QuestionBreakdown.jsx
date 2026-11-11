import { useState } from 'react'
import { createFlashcard } from '@/api/flashcards'
import Accordion from '@/components/common/Accordion'
import Badge from '@/components/common/Badge'
import Caption from '@/components/common/Caption'
import Card from '@/components/common/Card'
import SaveButton from '@/components/writing/SaveButton'
import { cn } from '@/lib/utils'
import { conceptCard } from '@/utils/cards'
import { scoreTone } from '@/utils/tone'
import Chip from './Chip'

const HIGHLIGHT = {
  error: 'border-b-2 border-rose-500 bg-rose-500/[.18]',
  gap: 'border-b-2 border-amber-500 bg-amber-500/20',
  key: 'border-b-2 border-emerald-500 bg-emerald-500/[.18]',
}
const TAG_TONE = { good: 'g', warn: 'a', bad: 'r' }
const SAVE_LABELS = {
  idle: 'Add to Mistake Flashcards',
  saving: 'Saving…',
  saved: 'Added to Flashcards',
  error: 'Try again',
}

function Fragments({ parts }) {
  return (
    <p className="m-0 whitespace-pre-wrap break-words text-sm leading-[1.75] text-slate-300">
      {parts.map((p, i) => (
        <span key={i} className={cn(HIGHLIGHT[p.kind])}>
          {p.text}
        </span>
      ))}
    </p>
  )
}

function FollowUps({ turns }) {
  return (
    <section aria-label="Follow-up exchange" className="flex flex-col gap-3">
      <Caption>Follow-up exchange</Caption>
      {turns.map((t, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-[10px] border border-slate-800 bg-slate-950 p-4">
          <span className="text-[13px] font-semibold text-sky-300">{t.question}</span>
          <span className="whitespace-pre-wrap break-words text-sm leading-normal text-slate-300">{t.answer}</span>
          <span className="text-[13px] leading-normal text-slate-400">{t.critique}</span>
        </div>
      ))}
    </section>
  )
}

export default function QuestionBreakdown({ questions }) {
  // Open the weakest question first: that is the one worth reading.
  const weakest = questions.reduce((low, q, i) => (q.score < questions[low].score ? i : low), 0)
  const [openIndex, setOpenIndex] = useState(weakest)
  // question number -> 'saving' | 'saved' | 'error'
  const [saves, setSaves] = useState({})

  async function save(question) {
    const status = saves[question.number]
    if (status === 'saving' || status === 'saved') return
    setSaves((s) => ({ ...s, [question.number]: 'saving' }))
    try {
      await createFlashcard(conceptCard(question))
      setSaves((s) => ({ ...s, [question.number]: 'saved' }))
    } catch {
      setSaves((s) => ({ ...s, [question.number]: 'error' }))
    }
  }

  return (
    <section aria-label="Question breakdown" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-50">Question-by-question breakdown</h2>
        <span className="text-[13px] text-slate-400">Select a question to expand it</span>
      </div>

      {questions.map((q, i) => {
        const open = openIndex === i
        return (
          <Card key={q.number} className="overflow-hidden">
            <Accordion
              id={`q${q.number}`}
              open={open}
              onToggle={() => setOpenIndex(open ? -1 : i)}
              header={
                <>
                  <span className="w-8 flex-none font-mono text-[13px] font-semibold text-indigo-300">Q{q.number}</span>
                  <span className="min-w-0 flex-[1_1_280px] text-sm font-medium leading-[1.45] text-slate-100">
                    {q.question}
                  </span>
                  <Chip>{q.category}</Chip>
                  <Badge tone={scoreTone(q.score)}>{q.score} / 100</Badge>
                </>
              }
            >
              <div className="flex flex-col gap-5 px-5 pb-[22px] pt-[18px]">
                {q.tags.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Caption>AI critique</Caption>
                    <div className="flex flex-wrap gap-2">
                      {q.tags.map((t) => (
                        <Badge key={t.text} tone={TAG_TONE[t.tone]}>
                          {t.text}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4">
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5 rounded-[10px] border border-slate-800 bg-slate-950 p-4">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
                      <i className="block size-2 rounded-full bg-amber-500" />
                      Your Answer
                    </span>
                    <Fragments parts={q.your_answer} />
                  </div>
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5 rounded-[10px] border border-emerald-500/30 bg-[#0b1a17] p-4">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-emerald-300">
                      <i className="block size-2 rounded-full bg-emerald-500" />
                      Optimal Reference Answer
                    </span>
                    <Fragments parts={q.reference_answer} />
                  </div>
                </div>

                {q.turns.length > 1 && <FollowUps turns={q.turns.slice(1)} />}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    Highlights: amber and red mark gaps in your answer, green marks key points to include.
                  </span>
                  <SaveButton status={saves[q.number]} labels={SAVE_LABELS} onClick={() => save(q)} />
                </div>
              </div>
            </Accordion>
          </Card>
        )
      })}
    </section>
  )
}
