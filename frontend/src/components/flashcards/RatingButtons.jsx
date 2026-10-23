import { cn } from '@/lib/utils'

// Hints are fixed for now; real intervals come with the SM-2 scheduler.
const RATINGS = [
  { name: 'Again', hint: '<10m', style: 'border-rose-500/50 text-rose-400 enabled:hover:bg-rose-500/[.14]' },
  { name: 'Hard', hint: '1d', style: 'border-amber-500/50 text-amber-400 enabled:hover:bg-amber-500/[.14]' },
  { name: 'Good', hint: '3d', style: 'border-indigo-500/60 text-indigo-300 enabled:hover:bg-indigo-500/20' },
  { name: 'Easy', hint: '7d', style: 'border-emerald-500/50 text-emerald-400 enabled:hover:bg-emerald-500/[.14]' },
]

export default function RatingButtons({ disabled, onRate }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-center text-[13px] text-slate-400">
        {disabled ? 'Flip the card to rate your recall' : 'How well did you remember it?'}
      </span>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))' }}>
        {RATINGS.map((r) => (
          <button
            key={r.name}
            type="button"
            disabled={disabled}
            onClick={onRate}
            className={cn(
              'flex h-[68px] flex-col items-center justify-center gap-1 rounded-xl border bg-slate-900 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-40',
              r.style,
            )}
          >
            {r.name}
            <span className="font-mono text-xs font-medium">{r.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
