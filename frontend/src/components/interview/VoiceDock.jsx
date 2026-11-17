import { ArrowRight, Check, Mic, RotateCcw, Square } from 'lucide-react'
import { DEFAULT_MAX_SECONDS, useAudioRecorder } from '@/hooks/useAudioRecorder'
import { formatMmSs } from '@/utils/time'
import { ghostButton, primaryButton } from './buttonStyles'
import Waveform from './Waveform'

const HELP = {
  idle: 'Tap the microphone to start recording.',
  error: 'Tap the microphone to try again.',
  recording: 'Tap the microphone to stop.',
  recorded: 'Happy with it? Send it, or record again.',
}

const LIMIT_MINUTES = DEFAULT_MAX_SECONDS / 60

// `onSendAudio(blob, mimeType)` is optional: until the page can upload audio, Send answer stays locked.
export default function VoiceDock({ sending, onSendAudio }) {
  const { status, error, blob, mimeType, seconds, limitReached, level, start, stop, reset } = useAudioRecorder()
  const recording = status === 'recording'
  const recorded = status === 'recorded'
  const canSend = Boolean(onSendAudio) && recorded && !sending

  async function recordAgain() {
    reset()
    await start()
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/[.08] px-3.5 py-2.5 text-[13px] leading-normal text-rose-300"
        >
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-5 pb-1 pt-2">
        <div className="flex flex-col items-center gap-1">
          <span
            role="timer"
            aria-label="Recording duration"
            className="font-mono text-[28px] font-semibold tracking-tight text-slate-50"
          >
            {formatMmSs(seconds)}
          </span>
          {recording && (
            <span className="flex items-center gap-1.5 text-xs text-rose-400">
              <i className="block size-2 rounded-full bg-rose-400 motion-safe:animate-pulse" aria-hidden="true" />
              Recording
            </span>
          )}
          {recorded && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="size-3.5" aria-hidden="true" />
              Recorded
            </span>
          )}
        </div>
        {!recorded && (
          <button
            type="button"
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            onClick={recording ? stop : start}
            disabled={sending}
            className="relative flex size-[72px] shrink-0 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {recording && (
              <>
                <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 motion-safe:animate-[pulse-ring_2s_ease-out_infinite]" />
                <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 [animation-delay:-1s] motion-safe:animate-[pulse-ring_2s_ease-out_infinite]" />
              </>
            )}
            {recording ? <Square className="size-7" aria-hidden="true" /> : <Mic className="size-[30px]" aria-hidden="true" />}
          </button>
        )}
        {recording && <Waveform tone="rose" level={level} className="h-12 max-w-[300px] flex-[1_1_180px]" />}
      </div>
      {limitReached && (
        <p className="text-center text-xs text-amber-300">
          You reached the {LIMIT_MINUTES}-minute limit, so the recording stopped.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{HELP[status]}</span>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={!(recording || recorded) || sending}
            onClick={recordAgain}
            className={ghostButton}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Re-record
          </button>
          <button
            type="button"
            disabled={!canSend}
            aria-describedby={onSendAudio ? undefined : 'voice-send-note'}
            onClick={() => onSendAudio(blob, mimeType)}
            className={primaryButton}
          >
            Send answer
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {!onSendAudio && (
        <p id="voice-send-note" className="text-xs text-slate-400">
          Sending voice answers isn't available yet. Switch to Text &amp; Code to submit an answer.
        </p>
      )}
    </>
  )
}
