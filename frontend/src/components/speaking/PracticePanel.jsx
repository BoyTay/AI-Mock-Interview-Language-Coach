import { AlertCircle, Mic, RefreshCw, RotateCcw, Sparkles, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import Card from '@/components/common/Card'
import AudioPlayer from '@/components/interview/AudioPlayer'
import { ghostButton, primaryButton } from '@/components/interview/buttonStyles'
import Waveform from '@/components/interview/Waveform'
import { cn } from '@/lib/utils'
import { formatClock } from '@/utils/time'

export const MIN_SECONDS = 30
export const MAX_SECONDS = 120

const MIN_CLOCK = formatClock(MIN_SECONDS)
const MAX_CLOCK = formatClock(MAX_SECONDS)

function ErrorBlock({ className, children }) {
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-[10px] border border-rose-500/35 bg-rose-500/[.08] px-3.5 py-3', className)}
    >
      <AlertCircle className="mt-px size-[18px] flex-none text-rose-400" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
    </div>
  )
}

function MicButton({ status, onStart, onStop }) {
  if (status === 'recording') {
    return (
      <button
        type="button"
        aria-label="Stop recording"
        onClick={onStop}
        className="relative flex size-[72px] shrink-0 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 motion-safe:animate-[pulse-ring_2s_ease-out_infinite]" />
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 [animation-delay:-1s] motion-safe:animate-[pulse-ring_2s_ease-out_infinite]" />
        <Square className="size-[26px]" fill="currentColor" aria-hidden="true" />
      </button>
    )
  }
  return (
    <button
      type="button"
      aria-label="Start recording"
      onClick={onStart}
      disabled={status === 'error'}
      className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-indigo-600"
    >
      <Mic className="size-[30px]" aria-hidden="true" />
    </button>
  )
}

function PromptCard({ promptState, recorder, phase, hasResult, onNewPrompt }) {
  const { prompt, status } = promptState
  const [confirming, setConfirming] = useState(false)
  const recording = recorder.status === 'recording'
  const hasWork = recorder.status === 'recorded' || hasResult

  function askNew() {
    if (hasWork) setConfirming(true)
    else onNewPrompt()
  }

  function discard() {
    setConfirming(false)
    onNewPrompt()
  }

  // Once there is nothing left to discard, or a recording or grading takes over, the question is void
  // and must not come back later.
  const blocked = recording || phase === 'grading'
  useEffect(() => {
    if (!hasWork || blocked) setConfirming(false)
  }, [hasWork, blocked])
  const showConfirm = confirming && hasWork && !blocked

  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full border border-sky-400/[.32] bg-sky-400/[.12] px-2.5 font-mono text-xs font-medium text-sky-300">
          Tech Daily Standup
        </span>
        <span className="font-mono text-xs text-slate-400">1-2 min</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={prompt ? askNew : promptState.retry}
          disabled={status === 'loading' || recording || phase === 'grading'}
          className={ghostButton}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {prompt ? 'New prompt' : 'Try again'}
        </button>
      </div>
      {prompt ? (
        <p className="m-0 text-pretty text-base leading-[1.6] text-slate-50">{prompt.prompt}</p>
      ) : (
        <p role="status" className="m-0 text-base text-slate-400">
          {status === 'error' ? "Couldn't load a prompt." : 'Loading prompt...'}
        </p>
      )}
      {prompt && status === 'error' && (
        <span role="alert" className="text-xs text-amber-400">
          Couldn't load another prompt. Keeping the current one.
        </span>
      )}
      {showConfirm && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-slate-700 bg-slate-950 px-3.5 py-3"
        >
          <span className="min-w-[200px] flex-1 text-[13px] text-slate-200">
            Discard this recording? Your result will be cleared too.
          </span>
          <button
            type="button"
            onClick={discard}
            className={cn(ghostButton, 'border-rose-500/40 text-rose-400')}
          >
            Discard
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={ghostButton}>
            Cancel
          </button>
        </div>
      )}
    </Card>
  )
}

export default function PracticePanel({
  promptState,
  recorder,
  phase,
  evaluateError,
  hasResult = false,
  onEvaluate,
  onRecordAgain,
  onNewPrompt,
}) {
  const { status, seconds, level, limitReached } = recorder
  const recording = status === 'recording'
  const recorded = status === 'recorded'
  const grading = phase === 'grading'
  const tooShort = seconds < MIN_SECONDS

  return (
    <section aria-label="Practice" className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
      <PromptCard
        promptState={promptState}
        recorder={recorder}
        phase={phase}
        hasResult={hasResult}
        onNewPrompt={onNewPrompt}
      />

      <Card className="flex flex-col items-center gap-3.5 px-5 pb-[22px] pt-7">
        {!recorded && (
          <>
            <MicButton status={status} onStart={recorder.start} onStop={recorder.stop} />
            <div role="timer" aria-label="Recording time" className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-slate-50">
                {formatClock(seconds)}
              </span>{' '}
              <span className="font-mono text-[13px] text-slate-400">/ {MAX_CLOCK}</span>
            </div>
          </>
        )}
        {recording && (
          <div className="flex w-full flex-col items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-xs text-rose-400">
              <i className="block size-2 rounded-full bg-rose-400 motion-safe:animate-pulse" aria-hidden="true" />
              Recording
            </span>
            <Waveform tone="rose" level={level} className="h-10 w-full max-w-[300px] motion-reduce:hidden" />
            <span className="text-xs text-slate-400">Stops by itself at {MAX_CLOCK}.</span>
          </div>
        )}
        {status === 'idle' && (
          <span className="text-center text-[13px] text-slate-400">Press to start. Speak for 1-2 minutes.</span>
        )}
        {status === 'error' && (
          <ErrorBlock className="w-full px-4 py-3.5">
            <span className="text-sm font-semibold text-slate-50">Microphone access is blocked</span>
            <span className="text-[13px] leading-normal text-slate-300">{recorder.error}</span>
            <div>
              <button type="button" onClick={recorder.start} className={ghostButton}>
                Try again
              </button>
            </div>
          </ErrorBlock>
        )}

        {recorded && (
          <div className="flex w-full flex-col gap-3.5">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[.08em] text-slate-400">
              Your recording
            </span>
            <AudioPlayer blob={recorder.blob} label="Your recording" />
            {limitReached && <p className="m-0 text-xs text-amber-300">Recording stopped at {MAX_CLOCK}.</p>}
            {evaluateError && (
              <ErrorBlock>
                <span className="text-[13px] leading-normal text-slate-200">{evaluateError}</span>
              </ErrorBlock>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={onRecordAgain} disabled={grading} className={ghostButton}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Record again
              </button>
              <div className="flex-1" />
              {phase !== 'graded' && (
                <button
                  type="button"
                  onClick={onEvaluate}
                  disabled={tooShort || grading || !promptState.prompt}
                  aria-busy={grading}
                  aria-describedby={tooShort ? 'practice-length-hint' : undefined}
                  className={cn(primaryButton, 'h-11 px-5')}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {grading ? 'Evaluating...' : 'Evaluate'}
                </button>
              )}
            </div>
            {tooShort && phase !== 'graded' && (
              <span id="practice-length-hint" className="text-right text-xs text-amber-400">
                Speak for at least {MIN_CLOCK}
              </span>
            )}
          </div>
        )}
      </Card>
    </section>
  )
}
