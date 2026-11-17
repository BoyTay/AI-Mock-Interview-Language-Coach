import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const HEIGHTS = [45, 70, 90, 60]
const MIN_HEIGHT = 8 // percent: a bar never disappears, so silence still shows a line
const GAIN = 3 // speech measures about 0.05 to 0.3, which would look flat without a boost

const barColour = (tone) => (tone === 'rose' ? 'bg-rose-400' : 'bg-indigo-400')

function barHeight(level) {
  const percent = MIN_HEIGHT + (100 - MIN_HEIGHT) * Math.min(1, level * GAIN)
  return `${Math.round(percent * 10) / 10}%`
}

// Follows a microphone level: each new level becomes the rightmost bar and older ones scroll left.
function LiveWaveform({ bars, tone, className, level }) {
  const [history, setHistory] = useState(() => Array(bars).fill(0))

  useEffect(() => {
    setHistory((past) => [...past.slice(-(bars - 1)), level])
  }, [level, bars])

  return (
    <div className={cn('flex items-center justify-center gap-1', className)} aria-hidden="true">
      {history.map((value, i) => (
        <i
          key={i}
          className={cn('block w-1 origin-center rounded-sm transition-[height] duration-75 motion-reduce:transition-none', barColour(tone))}
          style={{ height: barHeight(value) }}
        />
      ))}
    </div>
  )
}

// Decorative unless `level` is given. Decorative bars animate with the `wave` keyframes
// unless reduced motion is requested.
export default function Waveform({ bars = 32, tone = 'indigo', className, level }) {
  if (typeof level === 'number') return <LiveWaveform bars={bars} tone={tone} className={className} level={level} />
  return (
    <div className={cn('flex items-center justify-center gap-1', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i
          key={i}
          className={cn(
            'block w-1 origin-center scale-y-[.6] rounded-sm motion-safe:animate-[wave_1.1s_ease-in-out_infinite]',
            barColour(tone),
          )}
          style={{ height: `${HEIGHTS[i % HEIGHTS.length]}%`, animationDelay: `${-((i * 37) % 11) / 10}s` }}
        />
      ))}
    </div>
  )
}
