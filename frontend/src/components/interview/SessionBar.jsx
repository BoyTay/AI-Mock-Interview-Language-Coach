import { Clock, Code, Square } from 'lucide-react'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import ProgressSegments from '@/components/common/ProgressSegments'
import { useTimer } from '@/hooks/useTimer'
import { formatMmSs } from '@/utils/time'

export default function SessionBar({ session }) {
  const elapsed = useTimer({ start: session.elapsedStart })
  const answered = session.questionNumber - 1

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-3.5">
      <Badge tone="i">
        <Code className="size-3.5" aria-hidden="true" />
        {session.role}
      </Badge>
      <div className="flex min-w-[200px] flex-[1_1_240px] flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-50">
            Question {session.questionNumber} of {session.total}
          </span>
          <span className="font-mono text-xs text-slate-400">Topic: {session.topic}</span>
        </div>
        <ProgressSegments
          total={session.total}
          answered={answered}
          label={`Progress: ${answered} answered, question ${session.questionNumber} in progress`}
        />
      </div>
      <div className="flex items-center gap-2" role="timer" aria-label="Elapsed time">
        <Clock className="size-4 text-slate-400" aria-hidden="true" />
        <span className="font-mono text-base font-semibold text-slate-50">{formatMmSs(elapsed)}</span>
        <span className="text-xs text-slate-400">elapsed</span>
      </div>
      <button
        type="button"
        className="inline-flex h-[38px] items-center gap-2 whitespace-nowrap rounded-lg border border-rose-500/50 bg-rose-500/[.08] px-3.5 text-[13px] font-semibold text-rose-400 hover:bg-rose-500/[.18]"
      >
        <Square className="size-3.5" aria-hidden="true" />
        End Session
      </button>
    </Card>
  )
}
