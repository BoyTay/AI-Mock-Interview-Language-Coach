import { RefreshCw } from 'lucide-react'
import { forwardRef } from 'react'
import Caption from '@/components/common/Caption'

const FlipCard = forwardRef(function FlipCard({ card, flipped, onFlip }, ref) {
  return (
    <div className="flip-scene w-full">
      <button
        ref={ref}
        type="button"
        aria-pressed={flipped}
        onClick={onFlip}
        className="flip-card relative block h-[360px] w-full cursor-pointer rounded-2xl border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
      >
        <span className="sr-only">Flashcard. Press to flip between question and answer.</span>
        <span
          aria-hidden={flipped}
          className="flip-face absolute inset-0 flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 px-8 py-7"
        >
          <span className="flex items-center justify-between gap-2.5">
            <Caption>{card.frontCap}</Caption>
            <span className="font-mono text-xs text-slate-400">{card.source}</span>
          </span>
          <span className="flex flex-[1_1_auto] items-center text-pretty text-2xl font-semibold leading-[1.45] tracking-tight text-slate-50">
            {card.front}
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Click to reveal the answer
          </span>
        </span>
        <span
          aria-hidden={!flipped}
          className="flip-face flip-back absolute inset-0 flex flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#0d1c26] px-8 py-7"
        >
          <span className="flex items-center justify-between gap-2.5">
            <Caption className="text-emerald-300">{card.backCap}</Caption>
            <span className="font-mono text-xs text-slate-400">{card.tag}</span>
          </span>
          <span className="text-pretty text-[21px] font-semibold leading-[1.45] text-emerald-400">{card.back}</span>
          <span className="text-pretty text-sm leading-[1.65] text-slate-300">{card.why}</span>
        </span>
      </button>
    </div>
  )
})

export default FlipCard
