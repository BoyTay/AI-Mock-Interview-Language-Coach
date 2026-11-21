import { Loader2, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fetchAnswerAudio } from '@/api/interview'
import { cn } from '@/lib/utils'
import { formatMmSs } from '@/utils/time'
import { decodePeaks, nextSpeed, WAVE_BARS } from '@/utils/waveform'

const SEEK_STEP = 5 // seconds per arrow key
const FLAT = Array(WAVE_BARS).fill(0)

// Only one recording plays at a time: starting one pauses the one before.
let activeAudio = null

// Two SVG paths in a 240x32 box, as in the design: bars before the playhead and the rest.
function barPaths(peaks, progress) {
  let played = ''
  let rest = ''
  peaks.forEach((peak, i) => {
    const x = 2 + i * 5
    const half = Math.max(1, peak * 14)
    const bar = `M${x} ${(16 - half).toFixed(1)} V${(16 + half).toFixed(1)} `
    if ((i + 0.5) / peaks.length < progress) played += bar
    else rest += bar
  })
  return { played, rest }
}

export default function AudioPlayer({ sessionId, messageId, label = 'Recording' }) {
  const audioRef = useRef(null)
  const dragging = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('loading') // loading | ready | error (download) | unplayable (browser)
  const [src, setSrc] = useState(null)
  const [wave, setWave] = useState(null) // { duration, peaks } once decoded
  const [elementDuration, setElementDuration] = useState(NaN)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    let url = null
    setStatus('loading')
    setWave(null)
    fetchAnswerAudio(sessionId, messageId, { signal: controller.signal }).then(
      (blob) => {
        if (!live) return
        url = URL.createObjectURL(blob)
        setSrc(url)
        setStatus('ready')
        decodePeaks(blob, WAVE_BARS).then(
          (decoded) => live && setWave(decoded),
          () => {}, // still playable; the bars stay flat and the element gives the duration
        )
      },
      () => live && setStatus('error'),
    )
    return () => {
      live = false
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [sessionId, messageId, attempt])

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio.pause()
      if (activeAudio === audio) activeAudio = null
    }
  }, [])

  // timeupdate fires only a few times a second; follow the playhead every frame instead.
  useEffect(() => {
    if (!playing) return undefined
    let frame
    const follow = () => {
      setCurrent(audioRef.current.currentTime)
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const duration = wave?.duration ?? (Number.isFinite(elementDuration) ? elementDuration : null)
  const ready = status === 'ready'
  const canSeek = ready && duration != null && duration > 0
  const shown = Math.min(current, duration ?? current)
  const { played, rest } = barPaths(wave?.peaks?.length ? wave.peaks : FLAT, canSeek ? shown / duration : 0)

  function seek(seconds) {
    if (!canSeek) return
    const time = Math.min(duration, Math.max(0, seconds))
    audioRef.current.currentTime = time
    setCurrent(time)
  }

  function seekToPointer(event) {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width > 0) seek(((event.clientX - box.left) / box.width) * duration)
  }

  function togglePlay() {
    const audio = audioRef.current
    if (playing) audio.pause()
    else Promise.resolve(audio.play()).catch(() => setPlaying(false))
  }

  function changeSpeed() {
    const next = nextSpeed(speed)
    audioRef.current.playbackRate = next
    audioRef.current.defaultPlaybackRate = next
    setSpeed(next)
  }

  function onKeyDown(event) {
    const target = {
      ArrowRight: current + SEEK_STEP,
      ArrowUp: current + SEEK_STEP,
      ArrowLeft: current - SEEK_STEP,
      ArrowDown: current - SEEK_STEP,
      Home: 0,
      End: duration,
    }[event.key]
    if (target === undefined || !canSeek) return
    event.preventDefault()
    seek(target)
  }

  return (
    <div className="flex items-center gap-3.5 rounded-[10px] border border-slate-800 bg-slate-950 px-3.5 py-2.5">
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        onPlay={(e) => {
          if (activeAudio && activeAudio !== e.currentTarget) activeAudio.pause()
          activeAudio = e.currentTarget
          setPlaying(true)
        }}
        onPause={(e) => {
          setPlaying(false)
          setCurrent(e.currentTarget.currentTime)
        }}
        onEnded={() => setPlaying(false)}
        onError={() => src && setStatus('unplayable')}
        onDurationChange={(e) => setElementDuration(e.currentTarget.duration)}
        onLoadedMetadata={(e) => setElementDuration(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={togglePlay}
        disabled={!ready}
        aria-label={playing ? 'Pause recording' : 'Play recording'}
        className="grid size-9 flex-none place-items-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'loading' ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-px" fill="currentColor" aria-hidden="true" />
        )}
      </button>
      {status === 'loading' && (
        <span role="status" className="sr-only">
          Loading recording…
        </span>
      )}

      {status === 'unplayable' ? (
        <p className="m-0 min-w-0 flex-1 text-[13px] text-slate-400">This recording can't be played in this browser.</p>
      ) : status === 'error' ? (
        <p className="m-0 min-w-0 flex-1 text-[13px] text-slate-400">
          Recording unavailable.{' '}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="font-medium text-indigo-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Try again
          </button>
        </p>
      ) : (
        <div
          role="slider"
          tabIndex={canSeek ? 0 : -1}
          aria-label={`${label} position`}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration ?? 0)}
          aria-valuenow={Math.round(shown)}
          aria-valuetext={canSeek ? `${formatMmSs(shown)} of ${formatMmSs(duration)}` : 'Duration unknown'}
          aria-disabled={canSeek ? undefined : 'true'}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            if (!canSeek || e.button !== 0) return
            dragging.current = true
            e.currentTarget.setPointerCapture?.(e.pointerId)
            seekToPointer(e)
          }}
          onPointerMove={(e) => dragging.current && seekToPointer(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          className={cn(
            'min-w-[80px] flex-1 touch-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
            canSeek && 'cursor-pointer',
          )}
        >
          <svg viewBox="0 0 240 32" preserveAspectRatio="none" className="block h-8 w-full" aria-hidden="true">
            <path d={played} stroke="#818cf8" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d={rest} stroke="#475569" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      )}

      <span className="whitespace-nowrap font-mono text-xs text-slate-400">
        {formatMmSs(shown)} / {duration == null ? '--:--' : formatMmSs(duration)}
      </span>
      <button
        type="button"
        onClick={changeSpeed}
        disabled={!ready}
        aria-label={`Playback speed ${speed}x`}
        className="flex-none rounded-[5px] border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-300 hover:border-slate-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {speed}x
      </button>
    </div>
  )
}
