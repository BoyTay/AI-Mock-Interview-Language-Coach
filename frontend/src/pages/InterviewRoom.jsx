import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { describeInterviewError, finishInterview, submitAnswer } from '@/api/interview'
import Card from '@/components/common/Card'
import AnswerDock from '@/components/interview/AnswerDock'
import CompleteCard from '@/components/interview/CompleteCard'
import EndSessionDialog from '@/components/interview/EndSessionDialog'
import HintAccordion from '@/components/interview/HintAccordion'
import InterviewerCard from '@/components/interview/InterviewerCard'
import QuestionCard from '@/components/interview/QuestionCard'
import SessionBar from '@/components/interview/SessionBar'
import Transcript from '@/components/interview/Transcript'
import { applyAnswer, clearSession, loadSession, saveSession } from '@/utils/interviewSession'

const CODE_LANGUAGES = { SQL: 'SQL', JAVA: 'Java', PYTHON: 'Python', REACT: 'JSX' }
const DIFFICULTY_LABELS = { JUNIOR: 'Easy', MID: 'Medium', SENIOR: 'Hard' }

function NotAvailable({ sessionId }) {
  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      <h1 className="text-[26px] font-bold tracking-tight text-slate-50">This interview is not available here</h1>
      <p className="m-0 text-sm leading-normal text-slate-400">
        This browser does not hold the session, for example because it was started in another tab or the data was
        cleared. If you finished it, its report is still available.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          to="/interview"
          className="inline-flex h-[42px] items-center rounded-lg bg-indigo-600 px-[18px] text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Start a new session
        </Link>
        <Link
          to={`/interview/${sessionId}/report`}
          className="inline-flex h-[42px] items-center rounded-lg border border-slate-700 px-[18px] text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
        >
          View its report
        </Link>
      </div>
    </div>
  )
}

export default function InterviewRoom() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(() => loadSession(sessionId))
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [ending, setEnding] = useState(false) // the End Session confirmation is open
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')

  if (!room) return <NotAvailable sessionId={sessionId} />

  const { current, transcript } = room
  const answeredAny = transcript.some((m) => m.from === 'user')
  const chips = current ? [current.category, DIFFICULTY_LABELS[current.difficulty] ?? current.difficulty] : []

  async function onSend(answer) {
    setSending(true)
    setSendError('')
    try {
      const response = await submitAnswer(room.sessionId, answer)
      const next = applyAnswer(room, answer, response)
      saveSession(next)
      setRoom(next)
      return true
    } catch (err) {
      setSendError(describeInterviewError(err))
      return false
    } finally {
      setSending(false)
    }
  }

  async function onFinish() {
    setFinishing(true)
    setFinishError('')
    try {
      const report = await finishInterview(room.sessionId)
      clearSession(room.sessionId)
      navigate(`/interview/${room.sessionId}/report`, { state: { report } })
    } catch (err) {
      setFinishError(describeInterviewError(err))
      setFinishing(false)
    }
  }

  function leaveWithoutReport() {
    clearSession(room.sessionId)
    navigate('/interview')
  }

  const interviewerState = room.complete ? 'done' : sending ? 'thinking' : 'waiting'

  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-5">
      <h1 className="sr-only">Tech Mock Interview</h1>
      <SessionBar
        role={room.role}
        index={current?.index ?? room.total}
        total={room.total}
        topic={current?.category}
        startedAt={room.startedAt}
        complete={room.complete}
        onEnd={() => {
          setFinishError('')
          setEnding(true)
        }}
      />
      <div className="flex flex-wrap items-stretch gap-5">
        <section aria-label="AI interviewer" className="flex min-w-0 flex-[4_1_380px] flex-col gap-4">
          <InterviewerCard state={interviewerState} />
          {current && (
            <QuestionCard number={current.index} followUp={current.type === 'FOLLOW_UP'} text={current.text} chips={chips} />
          )}
          {current?.hint?.length > 0 && <HintAccordion concepts={current.hint} />}
        </section>
        <Card role="region" aria-label="Conversation" className="flex min-w-0 flex-[6_1_480px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <span className="text-[15px] font-semibold text-slate-50">Live transcript</span>
            <span className="font-mono text-xs text-slate-400">Text answers</span>
          </div>
          <Transcript
            messages={transcript}
            startedAt={room.startedAt}
            awaitingAnswer={!room.complete && !sending}
            thinking={sending}
          />
          {room.complete ? (
            <CompleteCard busy={finishing} error={finishError} onFinish={onFinish} />
          ) : (
            <AnswerDock
              onSend={onSend}
              sending={sending}
              error={sendError}
              language={CODE_LANGUAGES[current?.category] ?? 'Code'}
            />
          )}
        </Card>
      </div>
      {ending && (
        <EndSessionDialog
          answeredAny={answeredAny}
          busy={finishing}
          error={finishError}
          onConfirm={answeredAny ? onFinish : leaveWithoutReport}
          onCancel={() => setEnding(false)}
        />
      )}
    </div>
  )
}
