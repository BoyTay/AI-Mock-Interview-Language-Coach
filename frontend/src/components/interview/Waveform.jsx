import { cn } from '@/lib/utils'

const HEIGHTS = [45, 70, 90, 60]

// Decorative only. Bars animate with the `wave` keyframes unless reduced motion is requested.
export default function Waveform({ bars = 32, tone = 'indigo', className }) {
  return (
    <div className={cn('flex items-center justify-center gap-1', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i
          key={i}
          className={cn(
            'block w-1 origin-center scale-y-[.6] rounded-sm motion-safe:animate-[wave_1.1s_ease-in-out_infinite]',
            tone === 'rose' ? 'bg-rose-400' : 'bg-indigo-400',
          )}
          style={{ height: `${HEIGHTS[i % HEIGHTS.length]}%`, animationDelay: `${-((i * 37) % 11) / 10}s` }}
        />
      ))}
    </div>
  )
}
