import { cn } from '@/lib/utils'

export default function Chip({ className, children }) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center rounded-md border border-slate-700 bg-slate-950 px-2.5 font-mono text-xs font-medium text-indigo-200',
        className,
      )}
    >
      {children}
    </span>
  )
}
