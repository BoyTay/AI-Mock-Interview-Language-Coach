import { CheckCircle2, Loader2 } from 'lucide-react'

export default function CompleteCard({ busy, error, onFinish }) {
  return (
    <div className="flex flex-col gap-3.5 border-t border-slate-800 bg-[#0b1224] px-5 py-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-6 flex-none text-emerald-400" aria-hidden="true" />
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold text-slate-50">Interview complete</span>
          <span className="text-[13px] text-slate-400">That was the last question. Finish to get your report.</span>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/[.08] px-3.5 py-2.5 text-[13px] leading-normal text-rose-300"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onFinish}
        className="inline-flex h-[42px] items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-[18px] text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Finish and view report
      </button>
    </div>
  )
}
