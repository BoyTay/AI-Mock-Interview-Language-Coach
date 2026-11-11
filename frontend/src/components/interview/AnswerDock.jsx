import { ArrowRight, Code, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { composeAnswer } from '@/utils/interview'
import Chip from './Chip'

const primaryButton =
  'inline-flex h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-[18px] text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600'

// `onSend(answer)` resolves true when the answer was accepted; only then is the draft cleared,
// so a failed send leaves the candidate's words where they were.
export default function AnswerDock({ onSend, sending, language = 'Code', error }) {
  const [text, setText] = useState('')
  const [code, setCode] = useState('')
  const [codeOn, setCodeOn] = useState(false)

  const answer = composeAnswer({ text, code: codeOn ? code : '' })

  async function submit() {
    if (!answer || sending) return
    if (await onSend(answer)) {
      setText('')
      setCode('')
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 bg-[#0b1224] px-5 py-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/[.08] px-3.5 py-2.5 text-[13px] leading-normal text-rose-300"
        >
          {error}
        </div>
      )}
      <label htmlFor="answer-text" className="sr-only">
        Type your answer
      </label>
      <textarea
        id="answer-text"
        value={text}
        disabled={sending}
        onChange={(e) => setText(e.target.value)}
        placeholder="Explain your approach in your own words…"
        className="min-h-[84px] w-full resize-y rounded-[10px] border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm leading-normal text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500 disabled:opacity-60"
      />
      {codeOn && (
        <div className="overflow-hidden rounded-[10px] border border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2">
            <Chip className="h-[22px]">{language}</Chip>
            <span className="font-mono text-[11px] text-slate-400">monospace</span>
          </div>
          <label htmlFor="answer-code" className="sr-only">
            Code snippet
          </label>
          <textarea
            id="answer-code"
            value={code}
            disabled={sending}
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Write your code or pseudocode here"
            className="min-h-[120px] w-full resize-y border-0 bg-slate-950 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-indigo-200 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-pressed={codeOn}
          onClick={() => setCodeOn((v) => !v)}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium hover:bg-slate-800',
            codeOn ? 'border-indigo-600 bg-indigo-600/[.18] text-indigo-200' : 'border-slate-700 text-slate-300',
          )}
        >
          <Code className="size-4" aria-hidden="true" />
          Code block
        </button>
        <button type="button" disabled={!answer || sending} onClick={submit} className={primaryButton}>
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              Send answer
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
