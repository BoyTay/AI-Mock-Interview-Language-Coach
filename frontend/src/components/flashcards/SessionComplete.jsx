import { Check } from 'lucide-react'
import { forwardRef } from 'react'
import Card from '@/components/common/Card'

const SessionComplete = forwardRef(function SessionComplete({ onRestart }, headingRef) {
  return (
    <Card className="flex flex-col items-center gap-4 px-8 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/[.14]">
        <Check className="size-7 text-emerald-400" strokeWidth={2.4} aria-hidden="true" />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="m-0 text-[22px] font-bold text-slate-50 outline-none">
        Session complete
      </h2>
      <p className="m-0 text-sm leading-[1.6] text-slate-400">
        You reviewed all 15 cards due today. Cards you rated Again will return in under 10 minutes.
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Restart session
      </button>
    </Card>
  )
})

export default SessionComplete
