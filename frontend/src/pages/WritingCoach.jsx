import { useState } from 'react'
import EditorPanel from '@/components/writing/EditorPanel'
import { essayFromSegments, segments } from '@/mocks/writing'

export default function WritingCoach() {
  const [task, setTask] = useState('ielts')
  const [essay, setEssay] = useState(() => essayFromSegments(segments))

  return (
    <div className="flex w-full max-w-[1440px] flex-wrap items-start gap-5">
      <h1 className="sr-only">English Writing Coach</h1>
      <EditorPanel task={task} onTaskChange={setTask} essay={essay} onEssayChange={setEssay} />
    </div>
  )
}
