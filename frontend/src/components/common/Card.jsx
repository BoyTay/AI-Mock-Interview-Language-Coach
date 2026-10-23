import { cn } from '@/lib/utils'

export default function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-xl border border-slate-800 bg-slate-900', className)} {...props}>
      {children}
    </div>
  )
}
