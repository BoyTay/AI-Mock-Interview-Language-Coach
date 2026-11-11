import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'

const ghost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-slate-700 px-4 text-[13px] font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50'
const danger =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60'

export default function EndSessionDialog({ answeredAny, busy, error, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="End this session?"
        aria-describedby="end-session-text"
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-6"
      >
        <h2 className="m-0 text-lg font-semibold text-slate-50">End this session?</h2>
        <p id="end-session-text" className="m-0 text-sm leading-normal text-slate-300">
          {answeredAny
            ? 'Only the questions you have answered will be scored. You will get your report right away.'
            : 'You have not answered any question yet, so there will be no report.'}
        </p>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/[.08] px-3.5 py-2.5 text-[13px] leading-normal text-rose-300"
          >
            {error}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          <button type="button" autoFocus onClick={onCancel} disabled={busy} className={ghost}>
            Keep going
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={danger}>
            {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {answeredAny ? 'End and see report' : 'Leave session'}
          </button>
        </div>
      </div>
    </div>
  )
}
