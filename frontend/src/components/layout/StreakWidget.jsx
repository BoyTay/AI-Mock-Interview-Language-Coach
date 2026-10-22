import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StreakWidget({ days, week, collapsed }) {
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 py-2.5"
        title={`${days} Day Streak`}
      >
        <Flame className="size-[18px] text-amber-400" aria-hidden="true" />
        <span className="font-mono text-[13px] font-semibold text-slate-50">{days}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-[34px] items-center justify-center rounded-[9px] bg-amber-500/[.14]">
          <Flame className="size-[18px] text-amber-400" aria-hidden="true" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-50">{days} Day Streak</span>
          <span className="text-xs text-slate-400">Practice today to extend it</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1" aria-label="Last 7 days of practice">
        {week.map((done, i) => (
          <div
            key={i}
            data-filled={done}
            className={cn('h-1.5 rounded-[3px]', done ? 'bg-amber-500' : 'bg-slate-700')}
          />
        ))}
      </div>
    </div>
  )
}
