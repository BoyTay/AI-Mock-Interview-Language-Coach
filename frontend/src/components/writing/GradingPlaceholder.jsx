import { Sparkles } from 'lucide-react'
import Card from '@/components/common/Card'

export default function GradingPlaceholder() {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Sparkles className="size-6 text-indigo-300" aria-hidden="true" />
      <p role="status" className="m-0 max-w-[320px] text-sm leading-[1.6] text-slate-400">
        Write your essay, then press Evaluate with AI to see your band score, corrections and vocabulary upgrades.
      </p>
    </Card>
  )
}
