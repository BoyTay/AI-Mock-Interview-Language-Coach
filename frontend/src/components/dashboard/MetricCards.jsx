import { Activity, Code, Languages, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'
import { metrics } from '@/mocks/dashboard'

const ICONS = { sessions: Activity, tech: Code, band: Languages, due: Layers }

export default function MetricCards() {
  return (
    <section
      aria-label="Key metrics"
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))' }}
    >
      {metrics.map((m) => {
        const Icon = ICONS[m.key]
        const rose = m.key === 'due'
        return (
          <Card key={m.key} className="flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-400">{m.title}</span>
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg',
                  rose ? 'bg-rose-500/[.14]' : 'bg-indigo-500/[.16]',
                )}
              >
                <Icon className={cn('size-4', rose ? 'text-rose-400' : 'text-indigo-300')} aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[34px] font-semibold tracking-[-0.03em] text-slate-50">{m.value}</span>
              {m.unit && <span className="font-mono text-sm text-slate-400">{m.unit}</span>}
            </div>
            {m.progress !== undefined ? (
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 overflow-hidden rounded-[3px] bg-slate-800">
                  <div className="h-full rounded-[3px] bg-amber-500" style={{ width: `${m.progress}%` }} />
                </div>
                <span className="text-xs text-slate-400">{m.sub}</span>
              </div>
            ) : m.link ? (
              <Link to={m.link.to} className="text-[13px] font-medium text-indigo-300 hover:text-indigo-200">
                {m.link.label}
              </Link>
            ) : (
              <span className="text-xs font-medium text-emerald-400">{m.sub}</span>
            )}
          </Card>
        )
      })}
    </section>
  )
}
