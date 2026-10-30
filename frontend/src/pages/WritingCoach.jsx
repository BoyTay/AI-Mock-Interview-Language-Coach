import { useState } from 'react'
import { describeError, evaluateEssay } from '@/api/writing'
import BandSummary from '@/components/writing/BandSummary'
import EditorPanel from '@/components/writing/EditorPanel'
import FeedbackTabs from '@/components/writing/FeedbackTabs'
import GradingPlaceholder from '@/components/writing/GradingPlaceholder'
import { useDraft } from '@/hooks/useDraft'
import { usePrompt } from '@/hooks/usePrompt'
import { bandDeltaText, toCriteria, toSegments, toVocab } from '@/utils/grading'

function toGrading(result, essay) {
  return {
    id: result.id,
    overall: { band: result.overall_band, delta: bandDeltaText(result.band_delta) },
    criteria: toCriteria(result.band_scores),
    ...toSegments(essay, result.sentence_corrections),
    vocab: toVocab(result.upgraded_vocab),
  }
}

// Remounted per task (see the key below) so each task gets its own prompt, timer and draft.
function WritingSession({ task, onTaskChange }) {
  const promptState = usePrompt(task)
  const draft = useDraft(`writing-draft:${task}`)
  const [grading, setGrading] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState(null)

  async function evaluate() {
    const essay = draft.value
    setEvaluating(true)
    setError(null)
    try {
      const result = await evaluateEssay({ task, promptTopic: promptState.prompt.prompt, essay })
      setGrading(toGrading(result, essay))
    } catch (e) {
      setError(describeError(e))
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="flex w-full max-w-[1440px] flex-wrap items-start gap-5">
      <h1 className="sr-only">English Writing Coach</h1>
      <EditorPanel
        task={task}
        onTaskChange={onTaskChange}
        essay={draft.value}
        onEssayChange={draft.setValue}
        draftSaved={draft.saved}
        promptState={promptState}
        onEvaluate={evaluate}
        evaluating={evaluating}
        evaluateError={error}
      />
      <section aria-label="AI grading" className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
        {grading ? (
          <>
            <BandSummary overall={grading.overall} criteria={grading.criteria} />
            <FeedbackTabs key={grading.id} segments={grading.segments} unplaced={grading.unplaced} vocab={grading.vocab} />
          </>
        ) : (
          <GradingPlaceholder />
        )}
      </section>
    </div>
  )
}

export default function WritingCoach() {
  const [task, setTask] = useState('ielts')
  return <WritingSession key={task} task={task} onTaskChange={setTask} />
}
