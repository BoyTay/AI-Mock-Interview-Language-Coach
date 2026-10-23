import { cn } from '@/lib/utils'

export default function Caption({ className, children }) {
  return (
    <span className={cn('font-mono text-[11px] font-medium uppercase tracking-[.08em] text-slate-400', className)}>
      {children}
    </span>
  )
}
