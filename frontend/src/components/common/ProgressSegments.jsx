import { cn } from '@/lib/utils'

export default function ProgressSegments({ total, answered, label }) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      aria-label={label}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-[3px]',
            i < answered ? 'bg-indigo-600' : i === answered ? 'bg-indigo-300' : 'bg-slate-700',
          )}
        />
      ))}
    </div>
  )
}
