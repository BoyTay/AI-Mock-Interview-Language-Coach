import { cn } from '@/lib/utils'

const LABEL = { idle: '+ Save to Flashcards', saving: 'Saving...', saved: 'Saved to Flashcards', error: 'Try again' }

// status: 'idle' | 'saving' | 'saved' | 'error'. Only idle and error can be pressed, so a card is never sent twice.
export default function SaveButton({ status = 'idle', onClick }) {
  const locked = status === 'saving' || status === 'saved'
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-pressed={status === 'saved'}
        disabled={locked}
        onClick={onClick}
        className={cn(
          'inline-flex h-[38px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-semibold',
          status === 'saved'
            ? 'cursor-default border-emerald-500/40 bg-emerald-500/[.12] text-emerald-400'
            : 'border-indigo-600 bg-indigo-600/[.14] text-indigo-200 hover:bg-indigo-600/[.28] disabled:cursor-wait disabled:opacity-60',
        )}
      >
        {LABEL[status]}
      </button>
      {status === 'error' && (
        <span role="alert" className="text-xs text-amber-400">
          Could not save this card.
        </span>
      )}
    </div>
  )
}
