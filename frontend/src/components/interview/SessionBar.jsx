import { Clock, Code, Square } from 'lucide-react'
import { useState } from 'react'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import ProgressSegments from '@/components/common/ProgressSegments'
import { useTimer } from '@/hooks/useTimer'
import { formatMmSs } from '@/utils/time'

export default function SessionBar({ role, index, total, topic, startedAt, complete, onEnd }) {
  // The timer continues from when the session began, so it stays right after a refresh.
  const [elapsedStart] = useState(() => Math.floor((Date.now() - startedAt) / 1000))
  const elapsed = useTimer({ start: elapsedStart, running: !complete })
  const answered = complete ? total : index - 1

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-3.5">
      <Badge tone="i">
        <Code className="size-3.5" aria-hidden="true" />
        {role}
      </Badge>
      <div className="flex min-w-[200px] flex-[1_1_240px] flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-50">
            Question {complete ? total : index} of {total}
          </span>
          {topic && <span className="font-mono text-xs text-slate-400">Topic: {topic}</span>}
        </div>
        <ProgressSegments
          total={total}
          answered={answered}
          label={complete ? `Progress: all ${total} answered` : `Progress: ${answered} answered, question ${index} in progress`}
        />
      </div>
      <div className="flex items-center gap-2" role="timer" aria-label="Elapsed time">
        <Clock className="size-4 text-slate-400" aria-hidden="true" />
        <span className="font-mono text-base font-semibold text-slate-50">{formatMmSs(elapsed)}</span>
        <span className="text-xs text-slate-400">elapsed</span>
      </div>
      <button
        type="button"
        onClick={onEnd}
        className="inline-flex h-[38px] items-center gap-2 whitespace-nowrap rounded-lg border border-rose-500/50 bg-rose-500/[.08] px-3.5 text-[13px] font-semibold text-rose-400 hover:bg-rose-500/[.18]"
      >
        <Square className="size-3.5" aria-hidden="true" />
        End Session
      </button>
    </Card>
  )
}
