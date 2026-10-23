import { Sparkles } from 'lucide-react'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import Waveform from './Waveform'

export default function InterviewerCard() {
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
        <Badge tone="g">
          <i className="block size-2 rounded-full bg-emerald-400 motion-safe:animate-[blink_1.4s_ease-in-out_infinite]" />
          Speaking
        </Badge>
      </div>
      <Waveform className="h-[72px] px-1" />
    </Card>
  )
}
