import { ArrowRight } from 'lucide-react'
import Badge from '@/components/common/Badge'
import Caption from '@/components/common/Caption'
import SaveButton from '@/components/writing/SaveButton'
import { pronunciationCard, speakingGrammarCard, speakingVocabCard } from '@/utils/speaking'

function Becomes() {
  return <ArrowRight role="img" aria-label="becomes" className="size-3.5 text-slate-400" />
}

function Row({ tone, kind, why, status, onSave, children }) {
  return (
    <li className="flex flex-col gap-2.5 border-t border-slate-800 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={tone}>{kind}</Badge>
        {children}
      </div>
      <p className="m-0 text-[13px] leading-[1.55] text-slate-400">{why}</p>
      <SaveButton status={status} onClick={onSave} />
    </li>
  )
}

const Struck = ({ children }) => (
  <span className="font-mono text-sm font-medium text-rose-300 line-through decoration-[1.5px]">{children}</span>
)
const Fixed = ({ children }) => <span className="font-mono text-sm font-semibold text-emerald-400">{children}</span>

// Everything worth keeping as a flashcard. Fillers are left out: there is no card type for them.
export default function SpeakingMistakes({ result, saves, onSave }) {
  const { grammar_corrections: grammar, marks, vocabulary_upgrades: vocab } = result
  const pronunciation = marks.map((mark, index) => ({ mark, index })).filter((p) => p.mark.kind === 'pronunciation')

  if (grammar.length + pronunciation.length + vocab.length === 0) {
    return <p className="m-0 p-5 text-sm text-slate-400">Nothing to save from this recording.</p>
  }

  return (
    <ul aria-label="Mistakes to save" className="m-0 flex list-none flex-col px-5 pb-5 pt-2">
      {grammar.map((c, i) => (
        <Row
          key={`g${i}`}
          tone="i"
          kind="Grammar"
          why={c.explanation}
          status={saves[`g:${i}`]}
          onSave={() => onSave(`g:${i}`, speakingGrammarCard(c))}
        >
          <Struck>{c.original}</Struck>
          <Becomes />
          <Fixed>{c.corrected}</Fixed>
        </Row>
      ))}
      {pronunciation.map(({ mark, index }) => (
        <Row
          key={`p${index}`}
          tone="r"
          kind="Pronunciation"
          why={mark.note}
          status={saves[`p:${index}`]}
          onSave={() => onSave(`p:${index}`, pronunciationCard(mark))}
        >
          <span className="font-mono text-sm font-semibold text-slate-50">{mark.text}</span>
          <Caption>Say it</Caption>
          <Fixed>{mark.respelling}</Fixed>
        </Row>
      ))}
      {vocab.map((v, i) => (
        <Row
          key={`v${i}`}
          tone="s"
          kind="Vocabulary"
          why={v.explanation}
          status={saves[`v:${i}`]}
          onSave={() => onSave(`v:${i}`, speakingVocabCard(v))}
        >
          <Struck>{v.used}</Struck>
          <Becomes />
          <Fixed>{v.better}</Fixed>
        </Row>
      ))}
    </ul>
  )
}
