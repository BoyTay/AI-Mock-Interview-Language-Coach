import { cn } from '@/lib/utils'

export const TONES = {
  g: 'border-emerald-500/30 bg-emerald-500/[.12] text-emerald-400',
  a: 'border-amber-500/30 bg-amber-500/[.12] text-amber-400',
  r: 'border-rose-500/30 bg-rose-500/[.12] text-rose-400',
  i: 'border-indigo-500/35 bg-indigo-500/[.14] text-indigo-300',
  s: 'border-sky-400/[.32] bg-sky-400/[.12] text-sky-300',
}

export default function Badge({ tone = 'i', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
