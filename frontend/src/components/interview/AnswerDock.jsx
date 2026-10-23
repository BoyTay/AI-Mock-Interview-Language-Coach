import { ArrowRight, Code, Mic, Type } from 'lucide-react'
import { useState } from 'react'
import { useTimer } from '@/hooks/useTimer'
import { cn } from '@/lib/utils'
import { formatMmSs } from '@/utils/time'
import Chip from './Chip'
import Waveform from './Waveform'

const modeButton = (active) =>
  cn(
    'flex h-[34px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium',
    active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200',
  )

const ghostButton =
  'inline-flex h-[38px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-700 px-3.5 text-[13px] font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800'
const primaryButton =
  'inline-flex h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-[18px] text-sm font-semibold text-white hover:bg-indigo-700'

function VoiceMode() {
  const recording = useTimer({ start: 42 })

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-5 pb-1 pt-2">
        <div className="flex flex-col items-center gap-1">
          <span
            className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-slate-50"
            role="timer"
            aria-label="Recording duration"
          >
            {formatMmSs(recording)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-rose-400">
            <i className="block size-2 rounded-full bg-rose-400 motion-safe:animate-[blink_1.4s_ease-in-out_infinite]" />
            Recording
          </span>
        </div>
        <button
          type="button"
          aria-label="Stop recording"
          className="relative flex size-[72px] flex-none items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 opacity-0 motion-safe:animate-[pulse-ring_2s_ease-out_infinite]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 opacity-0 motion-safe:animate-[pulse-ring_2s_ease-out_-1s_infinite]"
          />
          <Mic className="size-[30px]" aria-hidden="true" />
        </button>
        <Waveform tone="rose" bars={32} className="h-12 max-w-[300px] flex-[1_1_180px]" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-400">Tap the microphone to stop. Your answer is transcribed automatically.</span>
        <div className="flex gap-2.5">
          <button type="button" className={ghostButton}>
            Re-record
          </button>
          <button type="button" className={primaryButton}>
            Send answer
          </button>
        </div>
      </div>
    </>
  )
}

function TextMode() {
  const [codeOn, setCodeOn] = useState(true)

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="answer-text" className="sr-only">
        Type your answer
      </label>
      <textarea
        id="answer-text"
        placeholder="Explain your approach in your own words…"
        className="min-h-[84px] w-full resize-y rounded-[10px] border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm leading-normal text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500"
      />
      {codeOn && (
        <div className="overflow-hidden rounded-[10px] border border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2">
            <Chip className="h-[22px]">SQL</Chip>
            <span className="font-mono text-[11px] text-slate-400">monospace · Tab inserts spaces</span>
          </div>
          <label htmlFor="answer-code" className="sr-only">
            Code snippet
          </label>
          <textarea
            id="answer-code"
            spellCheck={false}
            placeholder={'-- Write your SQL query or pseudocode here\nSELECT …'}
            className="min-h-[120px] w-full resize-y border-0 bg-slate-950 px-3.5 py-3 font-mono text-[13px] leading-relaxed text-indigo-200 outline-none placeholder:text-slate-400"
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
        <button type="button" className={primaryButton}>
          Send answer
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function AnswerDock({ initialMode = 'voice' }) {
  const [mode, setMode] = useState(initialMode)

  return (
    <div className="flex flex-col gap-3.5 border-t border-slate-800 bg-[#0b1224] px-5 py-4">
      <div
        role="group"
        aria-label="Answer mode"
        className="flex gap-0.5 self-start rounded-[9px] border border-slate-800 bg-slate-900 p-[3px]"
      >
        <button type="button" aria-pressed={mode === 'voice'} onClick={() => setMode('voice')} className={modeButton(mode === 'voice')}>
          <Mic className="size-3.5" aria-hidden="true" />
          Voice
        </button>
        <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')} className={modeButton(mode === 'text')}>
          <Type className="size-3.5" aria-hidden="true" />
          Text &amp; Code
        </button>
      </div>
      {mode === 'voice' ? <VoiceMode /> : <TextMode />}
    </div>
  )
}
