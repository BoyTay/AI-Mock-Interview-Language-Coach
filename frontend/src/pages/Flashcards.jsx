import Badge from '@/components/common/Badge'
import FlipCard from '@/components/flashcards/FlipCard'
import RatingButtons from '@/components/flashcards/RatingButtons'
import SessionComplete from '@/components/flashcards/SessionComplete'
import { useReviewSession } from '@/hooks/useReviewSession'
import { deck } from '@/mocks/flashcards'

const TOTAL = 15

export default function Flashcards() {
  const s = useReviewSession({ deck, total: TOTAL })

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-[15px] font-semibold text-slate-50">Mistake Flashcards</h1>
        <Badge tone="i">Active recall · SM-2</Badge>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-[15px] font-semibold text-slate-50">
            {s.finished ? `${TOTAL} of ${TOTAL} reviewed` : `Card ${s.n} of ${TOTAL} due today`}
          </span>
          {!s.finished && <Badge tone={s.card.tagTone}>{s.card.tag}</Badge>}
        </div>
        <div
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={0}
          aria-valuemax={TOTAL}
          aria-valuenow={s.doneCount}
          className="h-2 overflow-hidden rounded bg-slate-800"
        >
          <div className="h-full rounded bg-indigo-500" style={{ width: `${s.progressPct}%` }} />
        </div>
      </div>

      {s.finished ? (
        <SessionComplete onRestart={s.restart} />
      ) : (
        <div className="flex flex-col gap-6">
          <FlipCard card={s.card} flipped={s.flipped} onFlip={s.flip} />
          <RatingButtons disabled={!s.flipped} onRate={s.rate} />
        </div>
      )}
    </div>
  )
}
