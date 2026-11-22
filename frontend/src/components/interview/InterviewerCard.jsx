import { RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'
import Waveform from './Waveform'

const STATES = {
  waiting: { tone: 'g', label: 'Waiting for you', pulse: false },
  thinking: { tone: 'a', label: 'Thinking…', pulse: true },
  speaking: { tone: 'g', label: 'Speaking', pulse: true },
  done: { tone: 'i', label: 'Finished', pulse: false },
}

const smallButton =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50'
const quiet = 'border-slate-700 text-slate-200 hover:border-slate-600 hover:bg-slate-800'

// `readAloud` is 'on' | 'off', or null before the user has been asked.
export default function InterviewerCard({
  state = 'waiting',
  speechSupported = false,
  readAloud = null,
  onReadAloudChange,
  onReplay,
  canReplay = false,
}) {
  const { tone, label, pulse } = STATES[state]
  const on = readAloud === 'on'
  const toggleRef = useRef(null)
  const wasAsking = useRef(readAloud === null)

  // Answering the prompt removes the focused button: hand the focus to the toggle that replaces it.
  useEffect(() => {
    if (wasAsking.current && readAloud !== null) toggleRef.current?.focus()
    wasAsking.current = readAloud === null
  }, [readAloud])

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
            className={cn(
              'block size-2 rounded-full',
              pulse ? 'motion-safe:animate-[blink_1.4s_ease-in-out_infinite]' : '',
              state === 'thinking' ? 'bg-amber-400' : state === 'speaking' ? 'bg-emerald-400' : 'bg-current',
            )}
          />
          {label}
        </Badge>
      </div>
      <Waveform className="h-[72px] px-1" active={state === 'speaking'} />

      {speechSupported && readAloud === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-slate-800 bg-slate-950 px-3.5 py-2.5">
          <span className="text-[13px] text-slate-200">Read questions aloud?</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => onReadAloudChange('off')} className={cn(smallButton, quiet)}>
              Keep silent
            </button>
            <button
              type="button"
              onClick={() => onReadAloudChange('on')}
              className={cn(smallButton, 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700')}
            >
              <Volume2 className="size-3.5" aria-hidden="true" />
              Read aloud
            </button>
          </div>
        </div>
      )}

      {speechSupported && readAloud !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={toggleRef}
            type="button"
            aria-pressed={on}
            onClick={() => onReadAloudChange(on ? 'off' : 'on')}
            className={cn(
              smallButton,
              on ? 'border-indigo-600 bg-indigo-600/[.18] text-indigo-200 hover:bg-indigo-600/[.28]' : quiet,
            )}
          >
            {on ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
            Read questions aloud
          </button>
          <button type="button" disabled={!canReplay} onClick={onReplay} className={cn(smallButton, quiet)}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Replay question
          </button>
        </div>
      )}
    </Card>
  )
}
