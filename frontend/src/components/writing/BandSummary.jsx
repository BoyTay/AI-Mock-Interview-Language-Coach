import Card from '@/components/common/Card'
import { bandColor } from '@/utils/tone'

const FILL = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }
const TEXT = { emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400' }

export default function BandSummary({ overall, criteria }) {
  const band = overall.band.toFixed(1)

  return (
    <Card className="flex flex-col gap-[18px] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div
          role="img"
          aria-label={`Overall band ${band}`}
          className="flex size-24 flex-none flex-col items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/10"
        >
          <span aria-hidden="true" className="font-mono text-[11px] tracking-[.08em] text-emerald-300">
            BAND
          </span>
          <span aria-hidden="true" className="font-mono text-[38px] font-semibold leading-[1.1] tracking-[-0.04em] text-emerald-400">
            {band}
          </span>
        </div>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
          <span className="text-lg font-semibold text-slate-50">Overall Band Score</span>
          <span className="text-[13px] leading-normal text-slate-400">
            Good command of ideas and structure. Grammar accuracy and word choice hold the score back.
          </span>
          <span className="text-xs font-medium text-emerald-400">{overall.delta}</span>
        </div>
      </div>
      <ul aria-label="Criteria scores" className="m-0 flex list-none flex-col gap-3.5 p-0">
        {criteria.map((c) => {
          const color = bandColor(c.band)
          return (
            <li key={c.name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-slate-200">{c.name}</span>
                <span className={`font-mono text-sm font-semibold ${TEXT[color]}`}>{c.band.toFixed(1)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div className={`h-full rounded ${FILL[color]}`} style={{ width: `${Math.round((c.band / 9) * 100)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
