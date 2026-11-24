import { Mic } from 'lucide-react'
import { useState } from 'react'
import { createFlashcard } from '@/api/flashcards'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'
import { bandDeltaText } from '@/utils/grading'
import { bandTone, wpmVerdict } from '@/utils/speaking'
import { formatClock } from '@/utils/time'
import MarkedTranscript from './MarkedTranscript'
import SpeakingMistakes from './SpeakingMistakes'

const CRITERIA = [
  ['fluency', 'Fluency'],
  ['pronunciation', 'Pronunciation'],
  ['vocabulary', 'Vocabulary'],
  ['grammar', 'Grammar'],
]

const TILE = {
  emerald: 'border-emerald-500/35 bg-emerald-500/10',
  amber: 'border-amber-500/35 bg-amber-500/10',
  rose: 'border-rose-500/35 bg-rose-500/10',
}
const TILE_LABEL = { emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300' }
const TEXT = { emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400' }
const BADGE_TONE = { emerald: 'g', amber: 'a' }

const tabClass = (on) =>
  cn(
    'mr-5 flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm font-medium',
    on ? 'border-indigo-500 text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-200',
  )

function Empty() {
  return (
    <Card className="flex flex-col items-start gap-3 px-6 py-7">
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-indigo-500/[.16]">
        <Mic className="size-5 text-indigo-300" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold text-slate-50">Your feedback will appear here</span>
      <p className="m-0 max-w-[52ch] text-sm leading-[1.6] text-slate-400">
        Record your update and press Evaluate. You get four band scores, your speaking rate, a transcript with
        mispronounced and filler words marked, and the mistakes worth saving.
      </p>
    </Card>
  )
}

function Skeleton() {
  const block = 'block animate-pulse rounded-lg bg-slate-800 motion-reduce:animate-none'
  return (
    <Card aria-busy="true" aria-label="Grading your recording" className="flex flex-col gap-[18px] p-5">
      <div className="flex items-center gap-4">
        <span className={cn(block, 'size-24 flex-none rounded-2xl')} />
        <div className="flex flex-[1_1_0] flex-col gap-2.5">
          <span className={cn(block, 'h-4 w-[55%]')} />
          <span className={cn(block, 'h-3 w-[85%]')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn(block, 'h-[84px]')} />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {['w-full', 'w-[94%]', 'w-[97%]', 'w-[88%]', 'w-[60%]'].map((w) => (
          <span key={w} className={cn(block, 'h-3', w)} />
        ))}
      </div>
      <span className="text-[13px] text-slate-400">Listening to your recording. This usually takes under 20 seconds.</span>
    </Card>
  )
}

function Summary({ result, isPrevious }) {
  const tone = bandTone(result.overall_band)
  const band = result.overall_band.toFixed(1)
  const verdict = wpmVerdict(result.words_per_minute)
  const delta = result.band_delta
  const fillers = result.filler_count

  return (
    <Card className="flex flex-col gap-[18px] p-5">
      {isPrevious && <Badge className="self-start">Previous result</Badge>}
      <div className="flex flex-wrap items-center gap-4">
        <div
          role="img"
          aria-label={`Overall band ${band}`}
          className={cn('flex size-24 flex-none flex-col items-center justify-center rounded-2xl border', TILE[tone])}
        >
          <span aria-hidden="true" className={cn('font-mono text-[11px] tracking-[.08em]', TILE_LABEL[tone])}>
            BAND
          </span>
          <span
            aria-hidden="true"
            className={cn('font-mono text-[38px] font-semibold leading-[1.1] tracking-[-0.04em]', TEXT[tone])}
          >
            {band}
          </span>
        </div>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
          <span className="text-lg font-semibold text-slate-50">Overall band</span>
          <span className="text-[13px] leading-normal text-slate-400">{result.summary}</span>
          <span
            className={cn(
              'text-xs font-medium',
              delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-amber-400' : 'text-slate-400',
            )}
          >
            {bandDeltaText(delta, 'recording')}
          </span>
        </div>
      </div>
      <ul aria-label="Criteria scores" className="m-0 grid list-none grid-cols-2 gap-3 p-0">
        {CRITERIA.map(([key, name]) => {
          const c = result.criteria[key]
          return (
            <li key={key} className="flex flex-col gap-1 rounded-[10px] border border-slate-800 bg-slate-950 px-4 py-3.5">
              <span className="text-[13px] font-medium text-slate-300">{name}</span>
              <span className={cn('font-mono text-[28px] font-semibold leading-[1.15] tracking-[-0.03em]', TEXT[bandTone(c.score)])}>
                {c.score.toFixed(1)}
              </span>
              <span className="text-xs leading-[1.45] text-slate-400">{c.feedback}</span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-slate-800 pt-3.5 font-mono text-[15px] font-semibold text-slate-50">
        <span className="flex items-center gap-2">
          <span>{result.words_per_minute} words/min</span>
          <Badge tone={BADGE_TONE[verdict.tone]} className="h-[22px] text-[11px]">
            {verdict.label}
          </Badge>
        </span>
        <span>{fillers === 1 ? '1 filler' : `${fillers} fillers`}</span>
        <span className="flex items-baseline gap-1.5">
          <span>{formatClock(result.duration_seconds)}</span>
          <span className="font-sans text-xs font-normal text-slate-400">spoken</span>
        </span>
      </div>
    </Card>
  )
}

function Result({ result, isPrevious }) {
  const [tab, setTab] = useState('transcript')
  // Save progress lives here so it survives switching tabs. key -> 'saving' | 'saved' | 'error'
  const [saves, setSaves] = useState({})
  const setStatus = (key, status) => setSaves((s) => ({ ...s, [key]: status }))

  async function save(key, card) {
    if (saves[key] === 'saving' || saves[key] === 'saved') return
    setStatus(key, 'saving')
    try {
      await createFlashcard(card)
      setStatus(key, 'saved')
    } catch {
      setStatus(key, 'error')
    }
  }

  const mistakeCount =
    result.grammar_corrections.length +
    result.marks.filter((m) => m.kind === 'pronunciation').length +
    result.vocabulary_upgrades.length

  return (
    <>
      <Summary result={result} isPrevious={isPrevious} />
      <Card className="overflow-hidden">
        <div role="tablist" aria-label="Feedback views" className="flex flex-wrap border-b border-slate-800 px-5">
          <button
            type="button"
            role="tab"
            id="speaking-tab-transcript"
            aria-selected={tab === 'transcript'}
            aria-controls="speaking-panel"
            onClick={() => setTab('transcript')}
            className={tabClass(tab === 'transcript')}
          >
            Transcript
          </button>
          <button
            type="button"
            role="tab"
            id="speaking-tab-mistakes"
            aria-selected={tab === 'mistakes'}
            aria-controls="speaking-panel"
            onClick={() => setTab('mistakes')}
            className={tabClass(tab === 'mistakes')}
          >
            Mistakes
            <Badge tone="r" className="h-[22px] text-[11px]">
              {mistakeCount}
            </Badge>
          </button>
        </div>
        <div role="tabpanel" id="speaking-panel" aria-labelledby={`speaking-tab-${tab}`}>
          {tab === 'transcript' ? (
            <MarkedTranscript transcript={result.transcript} marks={result.marks} saves={saves} onSave={save} />
          ) : (
            <SpeakingMistakes result={result} saves={saves} onSave={save} />
          )}
        </div>
      </Card>
    </>
  )
}

function statusText(phase, result) {
  if (phase === 'grading') return 'Grading your recording.'
  if (phase === 'result' && result) return `Result ready: overall band ${result.overall_band.toFixed(1)}.`
  return ''
}

// phase: 'empty' | 'grading' | 'result'. The live region stays mounted across phases so a screen reader
// announces the result; Result is keyed by result.id so tab, selection and save states start fresh for each one.
export default function GradingPanel({ phase, result, isPrevious = false }) {
  const showResult = phase === 'result' && result

  return (
    <section aria-label="AI grading" className="flex min-w-0 flex-col gap-4">
      <div role="status" aria-live="polite" className="sr-only">
        {statusText(phase, result)}
      </div>
      {phase === 'grading' && <Skeleton />}
      {showResult && <Result key={result.id} result={result} isPrevious={isPrevious} />}
      {!showResult && phase !== 'grading' && <Empty />}
    </section>
  )
}
