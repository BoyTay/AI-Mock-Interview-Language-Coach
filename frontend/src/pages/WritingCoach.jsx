import { useState } from 'react'
import BandSummary from '@/components/writing/BandSummary'
import EditorPanel from '@/components/writing/EditorPanel'
import FeedbackTabs from '@/components/writing/FeedbackTabs'
import { criteria, essayFromSegments, overall, segments, vocab } from '@/mocks/writing'

export default function WritingCoach() {
  const [task, setTask] = useState('ielts')
  const [essay, setEssay] = useState(() => essayFromSegments(segments))

  return (
    <div className="flex w-full max-w-[1440px] flex-wrap items-start gap-5">
      <h1 className="sr-only">English Writing Coach</h1>
      <EditorPanel task={task} onTaskChange={setTask} essay={essay} onEssayChange={setEssay} />
      <section aria-label="AI grading" className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
        <BandSummary overall={overall} criteria={criteria} />
        <FeedbackTabs segments={segments} vocab={vocab} />
      </section>
    </div>
  )
}
