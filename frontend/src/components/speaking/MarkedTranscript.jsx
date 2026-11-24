import { Fragment, useState } from 'react'
import Badge from '@/components/common/Badge'
import Caption from '@/components/common/Caption'
import { cn } from '@/lib/utils'
import SaveButton from '@/components/writing/SaveButton'
import { pronunciationCard, toTranscriptSegments } from '@/utils/speaking'

const FILLER_TIP = 'Pause silently instead. A short pause sounds more confident than a filler.'

const MARK_STYLE = {
  pronunciation: 'underline decoration-rose-400 decoration-wavy decoration-[1.5px] underline-offset-[5px]',
  filler: 'text-slate-400 line-through decoration-slate-500',
}
const TAG = { pronunciation: 'pron.', filler: 'filler' }
const LABEL = { pronunciation: 'Pronunciation', filler: 'Filler' }

const usedLabel = (n) => (n === 1 ? 'Used once' : `Used ${n} times`)

// The mark the panel opens on: the first mispronounced word, else the first filler.
export function firstMarkIndex(marks) {
  const i = marks.findIndex((m) => m.kind === 'pronunciation')
  return i >= 0 ? i : marks.findIndex((m) => m.kind === 'filler')
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
      <span>Select a marked word for details.</span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className={cn('px-px text-slate-200', MARK_STYLE.pronunciation)}>
          word
        </span>
        Mispronounced
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className={cn('px-px', MARK_STYLE.filler)}>
          um
        </span>
        Filler word
      </span>
    </div>
  )
}

function MarkDetails({ mark, markIndex, marks, status, onSave }) {
  const key = `p:${markIndex}`
  const fillerCount = marks.filter((m) => m.kind === 'filler' && m.text.toLowerCase() === mark.text.toLowerCase()).length
  return (
    <div
      role="region"
      aria-label="Mark details"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border border-indigo-600 bg-slate-950 p-[18px]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={mark.kind === 'pronunciation' ? 'r' : 'a'}>{LABEL[mark.kind]}</Badge>
        <span className="font-mono text-base font-semibold text-slate-50">{mark.text}</span>
      </div>
      {mark.kind === 'pronunciation' ? (
        <div className="flex flex-col gap-2.5">
          <span className="flex items-baseline gap-2">
            <Caption>Say it</Caption>
            <span className="font-mono text-[15px] font-semibold text-emerald-400">{mark.respelling}</span>
          </span>
          <p className="m-0 text-sm leading-[1.6] text-slate-300">{mark.note}</p>
          <SaveButton status={status} onClick={() => onSave(key, pronunciationCard(mark))} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[13px] font-medium text-amber-400">{usedLabel(fillerCount)}</span>
          <p className="m-0 text-sm leading-[1.6] text-slate-300">{FILLER_TIP}</p>
        </div>
      )}
    </div>
  )
}

export default function MarkedTranscript({ transcript, marks, saves, onSave }) {
  const [selected, setSelected] = useState(() => firstMarkIndex(marks))
  const segments = toTranscriptSegments(transcript, marks)
  const current = marks[selected]

  return (
    <div className="flex flex-col gap-[18px] p-5">
      <Legend />
      <p className="m-0 text-pretty text-[15px] leading-[2.1] text-slate-200">
        {segments.map((s, i) => {
          if (s.type === 'text') return <Fragment key={`t${i}`}>{s.text}</Fragment>
          const on = s.index === selected
          return (
            <button
              key={`m${s.index}`}
              type="button"
              aria-label={`${LABEL[s.mark.kind]}: ${s.mark.text}`}
              aria-pressed={on}
              onClick={() => setSelected(s.index)}
              className={cn(
                'group inline rounded border-0 bg-transparent px-px py-0 font-[inherit] text-inherit hover:bg-indigo-500/[.16]',
                on && 'bg-indigo-500/[.16] outline outline-2 outline-offset-1 outline-indigo-400',
                MARK_STYLE[s.mark.kind],
              )}
            >
              {s.mark.text}
              <span
                aria-hidden="true"
                className={cn(
                  'ml-1 hidden rounded bg-slate-800 px-1 align-[2px] font-mono text-[10px] font-medium text-slate-300 no-underline group-hover:inline-block group-focus-visible:inline-block',
                  on && 'inline-block',
                )}
              >
                {TAG[s.mark.kind]}
              </span>
            </button>
          )
        })}
      </p>
      {current && (
        <MarkDetails mark={current} markIndex={selected} marks={marks} status={saves[`p:${selected}`]} onSave={onSave} />
      )}
    </div>
  )
}
