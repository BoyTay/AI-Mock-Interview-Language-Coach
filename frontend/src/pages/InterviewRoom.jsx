import { FileCheck, Mic } from 'lucide-react'
import { useState } from 'react'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import AnswerDock from '@/components/interview/AnswerDock'
import HintAccordion from '@/components/interview/HintAccordion'
import InterviewerCard from '@/components/interview/InterviewerCard'
import QuestionBreakdown from '@/components/interview/QuestionBreakdown'
import QuestionCard from '@/components/interview/QuestionCard'
import ReportSummary from '@/components/interview/ReportSummary'
import SessionBar from '@/components/interview/SessionBar'
import Transcript from '@/components/interview/Transcript'
import { cn } from '@/lib/utils'
import { question, report, reportQuestions, session, transcript } from '@/mocks/interview'

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

function ReportView() {
  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-tight text-slate-50">{report.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="i">{report.role}</Badge>
            <span className="font-mono text-[13px] text-slate-400">{report.meta}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className="inline-flex h-[38px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-700 px-3.5 text-[13px] font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            Download PDF
          </button>
          <button
            type="button"
            className="inline-flex h-[42px] items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-[18px] text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Retake interview
          </button>
        </div>
      </div>
      <ReportSummary report={report} />
      <QuestionBreakdown questions={reportQuestions} />
    </div>
  )
}

const VIEWS = [
  { id: 'room', label: 'Active Interview Room', icon: Mic },
  { id: 'report', label: 'Post-Interview Evaluation Report', icon: FileCheck },
]

export default function InterviewRoom() {
  const [view, setView] = useState('room')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[.08em] text-slate-400">Preview state</span>
          <span className="text-xs text-slate-400">Mock Interview module</span>
        </div>
        <div
          role="group"
          aria-label="Preview state"
          className="flex gap-0.5 rounded-[10px] border border-slate-800 bg-slate-900 p-[3px]"
        >
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn(
                'flex h-[38px] items-center justify-center gap-2 whitespace-nowrap rounded-[7px] px-4 text-[13px] font-medium',
                view === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'room' ? <RoomView /> : <ReportView />}
    </div>
  )
}
