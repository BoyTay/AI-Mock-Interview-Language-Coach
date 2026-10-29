import { useState } from 'react'
import BandSummary from '@/components/writing/BandSummary'
import EditorPanel from '@/components/writing/EditorPanel'
import FeedbackTabs from '@/components/writing/FeedbackTabs'
import { useDraft } from '@/hooks/useDraft'
import { usePrompt } from '@/hooks/usePrompt'
import { criteria, overall, segments, vocab } from '@/mocks/writing'

// Remounted per task (see the key below) so each task gets its own prompt, timer and draft.
function WritingSession({ task, onTaskChange }) {
  const promptState = usePrompt(task)
  const draft = useDraft(`writing-draft:${task}`)

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
      />
      <section aria-label="AI grading" className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
        <BandSummary overall={overall} criteria={criteria} />
        <FeedbackTabs segments={segments} vocab={vocab} />
      </section>
    </div>
  )
}

export default function WritingCoach() {
  const [task, setTask] = useState('ielts')
  return <WritingSession key={task} task={task} onTaskChange={setTask} />
}
