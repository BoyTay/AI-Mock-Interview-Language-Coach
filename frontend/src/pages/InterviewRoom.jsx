import AnswerDock from '@/components/interview/AnswerDock'
import HintAccordion from '@/components/interview/HintAccordion'
import InterviewerCard from '@/components/interview/InterviewerCard'
import QuestionCard from '@/components/interview/QuestionCard'
import SessionBar from '@/components/interview/SessionBar'
import Transcript from '@/components/interview/Transcript'
import Card from '@/components/common/Card'
import { question, session, transcript } from '@/mocks/interview'

function RoomView() {
  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-5">
      <h1 className="sr-only">Tech Mock Interview</h1>
      <SessionBar session={session} />
      <div className="flex flex-wrap items-stretch gap-5">
        <section aria-label="AI interviewer" className="flex min-w-0 flex-[4_1_380px] flex-col gap-4">
          <InterviewerCard />
          <QuestionCard number={session.questionNumber} followUp question={question} />
          <HintAccordion concepts={question.hint} />
        </section>
        <Card role="region" aria-label="Conversation" className="flex min-w-0 flex-[6_1_480px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <span className="text-[15px] font-semibold text-slate-50">Live transcript</span>
            <span className="font-mono text-xs text-slate-400">Auto-captioned</span>
          </div>
          <Transcript messages={transcript} />
          <AnswerDock />
        </Card>
      </div>
    </div>
  )
}

export default function InterviewRoom() {
  return <RoomView />
}
