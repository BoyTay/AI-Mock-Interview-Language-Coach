import { AlertTriangle, Check } from 'lucide-react'
import Badge from '@/components/common/Badge'
import Caption from '@/components/common/Caption'
import Card from '@/components/common/Card'
import ScoreRing from '@/components/common/ScoreRing'
import { cn } from '@/lib/utils'
import { scoreTone } from '@/utils/tone'

export default function ReportSummary({ report }) {
  return (
    <section aria-label="Summary" className="flex flex-wrap items-stretch gap-4">
      <Card className="flex min-w-0 flex-[1.1_1_340px] flex-col gap-[18px] p-5">
        <div className="flex flex-wrap items-center gap-5">
          <ScoreRing value={report.overall} tone={scoreTone(report.overall)} />
          <div className="flex min-w-0 flex-[1_1_160px] flex-col gap-2">
            <Caption>Overall score</Caption>
            <span className="text-lg font-semibold leading-tight text-slate-50">{report.headline}</span>
            <span className="text-[13px] leading-normal text-slate-400">{report.summary}</span>
            <span className="text-xs font-medium text-emerald-400">{report.delta}</span>
          </div>
        </div>
        <div className="h-px bg-slate-800" />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2.5">
            <Caption>STAR method compliance</Caption>
            <Badge tone="a">{report.star.percent}%</Badge>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {report.star.letters.map((l) => (
              <div
                key={l.k}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5',
                  l.good ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/35 bg-amber-500/10',
                )}
              >
                <span className={cn('font-mono text-base font-semibold', l.good ? 'text-emerald-400' : 'text-amber-400')}>
                  {l.k}
                </span>
                <span className="text-[11px] text-slate-300">{l.label}</span>
              </div>
            ))}
          </div>
          <span className="text-xs text-slate-400">{report.star.note}</span>
        </div>
      </Card>

      <Card className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 border-emerald-500/35 bg-[#0d1c26] p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/[.16]">
            <Check className="size-4 text-emerald-400" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-emerald-300">Key Strengths</h2>
        </div>
        <div className="flex flex-col gap-3.5">
          {report.strengths.map((s) => (
            <div key={s.title} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-50">{s.title}</span>
              <span className="text-[13px] leading-normal text-slate-300">{s.text}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 border-amber-500/40 bg-[#1a1a1c] p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/[.16]">
            <AlertTriangle className="size-4 text-amber-400" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-amber-300">Knowledge Gaps</h2>
        </div>
        <div className="flex flex-col gap-3.5">
          {report.gaps.map((g) => (
            <div key={g.title} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                {g.title}
                <Badge tone={g.level === 'High' ? 'r' : 'a'} className="h-[22px] text-[11px]">
                  {g.level}
                </Badge>
              </span>
              <span className="text-[13px] leading-normal text-slate-300">{g.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
