import { Check, FileText, Loader2, RefreshCw, Sparkles, Timer } from 'lucide-react'
import { useState } from 'react'
import Accordion from '@/components/common/Accordion'
import Card from '@/components/common/Card'
import { useTimer } from '@/hooks/useTimer'
import { cn } from '@/lib/utils'
import { formatMmSs } from '@/utils/time'
import { countWords } from '@/utils/text'

const TASKS = [
  { id: 'ielts', label: 'IELTS Writing Task 2' },
  { id: 'standup', label: 'Tech Daily Standup' },
]

function Countdown({ minutes }) {
  const remaining = useTimer({ start: minutes * 60, direction: 'down' })
  return (
    <>
      <span className="font-mono text-xl font-semibold tracking-[-0.02em] text-slate-50">{formatMmSs(remaining)}</span>
      <span className="font-mono text-xs text-slate-400">of {formatMmSs(minutes * 60)}</span>
    </>
  )
}

function promptNote({ min_words: min, max_words: max, suggested_minutes: minutes }) {
  const length = max ? `Write ${min} to ${max} words.` : `Write at least ${min} words.`
  return `${length} Suggested time: ${minutes} minutes.`
}

export default function EditorPanel({
  task,
  onTaskChange,
  essay,
  onEssayChange,
  draftSaved,
  promptState,
  onEvaluate,
  evaluating,
  evaluateError,
}) {
  const { prompt, status } = promptState
  const [promptOpen, setPromptOpen] = useState(true)
  const minWords = prompt?.min_words ?? 0
  const words = countWords(essay)
  const canEvaluate = Boolean(prompt) && words >= minWords && !evaluating

  return (
    <section aria-label="Editor" className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 px-[18px] py-3.5">
        <div
          role="group"
          aria-label="Task type"
          className="flex gap-0.5 rounded-[9px] border border-slate-800 bg-slate-950 p-[3px]"
        >
          {TASKS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={task === t.id}
              onClick={() => onTaskChange(t.id)}
              className={cn(
                'flex h-[34px] items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium',
                task === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5" role="timer" aria-label="Time remaining">
          <Timer className="size-[18px] text-amber-400" aria-hidden="true" />
          {prompt ? (
            <Countdown key={promptState.round} minutes={prompt.suggested_minutes} />
          ) : (
            <span className="font-mono text-xl font-semibold text-slate-500">--:--</span>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Accordion
          id="prompt"
          open={promptOpen}
          onToggle={() => setPromptOpen((o) => !o)}
          header={
            <>
              <span className="flex size-[30px] flex-none items-center justify-center rounded-lg bg-indigo-500/[.16]">
                <FileText className="size-4 text-indigo-300" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 font-semibold">Prompt topic</span>
            </>
          }
        >
          <div className="flex flex-col gap-2.5 px-5 pb-[18px]">
            {prompt ? (
              <>
                <p className="m-0 mt-3.5 text-pretty text-[15px] leading-[1.6] text-slate-200">{prompt.prompt}</p>
                <span className="font-mono text-xs text-slate-400">{promptNote(prompt)}</span>
              </>
            ) : (
              <p role="status" className="m-0 mt-3.5 text-[15px] text-slate-400">
                {status === 'error' ? "Couldn't load a prompt." : 'Loading prompt...'}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={prompt ? promptState.next : promptState.retry}
                disabled={status === 'loading'}
                className="inline-flex h-[34px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {prompt ? 'New prompt' : 'Try again'}
              </button>
              {prompt && status === 'error' && (
                <span role="alert" className="text-xs text-amber-400">
                  Couldn't load another prompt. Keeping the current one.
                </span>
              )}
            </div>
          </div>
        </Accordion>
      </Card>

      <Card className="overflow-hidden">
        <label htmlFor="essay" className="sr-only">
          Your essay
        </label>
        <textarea
          id="essay"
          spellCheck={false}
          value={essay}
          onChange={(e) => onEssayChange(e.target.value)}
          className="block min-h-[400px] w-full resize-y border-0 bg-slate-950 px-7 py-6 text-base leading-[1.85] text-slate-200 outline-none"
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-800 bg-[#0b1224] px-[18px] py-3.5">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'font-mono text-lg font-semibold',
                words >= minWords ? 'text-emerald-400' : 'text-amber-400',
              )}
            >
              {words} words
            </span>
            <span className="font-mono text-xs text-slate-400">min {minWords}</span>
          </div>
          {draftSaved ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
              Draft saved
            </span>
          ) : (
            essay && <span className="text-xs text-slate-500">Saving draft...</span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onEvaluate}
            disabled={!canEvaluate}
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600"
          >
            {evaluating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {evaluating ? 'Evaluating...' : 'Evaluate with AI'}
          </button>
        </div>
        {evaluateError && (
          <p role="alert" className="m-0 border-t border-slate-800 bg-amber-500/10 px-[18px] py-3 text-sm text-amber-300">
            {evaluateError}
          </p>
        )}
      </Card>
    </section>
  )
}
