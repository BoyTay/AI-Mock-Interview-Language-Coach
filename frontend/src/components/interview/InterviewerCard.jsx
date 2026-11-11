import { Sparkles } from 'lucide-react'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import Waveform from './Waveform'

const STATES = {
  waiting: { tone: 'g', label: 'Waiting for you', pulse: false },
  thinking: { tone: 'a', label: 'Thinking…', pulse: true },
  done: { tone: 'i', label: 'Finished', pulse: false },
}

export default function InterviewerCard({ state = 'waiting' }) {
  const { tone, label, pulse } = STATES[state]

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 flex-none items-center justify-center rounded-xl bg-indigo-900">
          <Sparkles className="size-[22px] text-indigo-200" aria-hidden="true" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold text-slate-50">AI Interviewer</span>
          <span className="text-xs text-slate-400">Technical round · English</span>
        </div>
        <div className="flex-1" />
        <Badge tone={tone}>
          <i
            className={
              pulse
                ? 'block size-2 rounded-full bg-amber-400 motion-safe:animate-[blink_1.4s_ease-in-out_infinite]'
                : 'block size-2 rounded-full bg-current'
            }
          />
          {label}
        </Badge>
      </div>
      <Waveform className="h-[72px] px-1" />
    </Card>
  )
}
