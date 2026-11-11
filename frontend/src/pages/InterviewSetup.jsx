import { AlertTriangle, Loader2, Mic, PenLine, SquareTerminal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { describeInterviewError, fetchProfile, startInterview } from '@/api/interview'
import Caption from '@/components/common/Caption'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'
import {
  COUNT_OPTIONS,
  DIFFICULTIES,
  JD_LIMIT,
  estimatedMinutes,
  questionTotalLabel,
} from '@/utils/interview'
import { createSession, saveSession } from '@/utils/interviewSession'

const fieldClass =
  'w-full rounded-[10px] border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm leading-normal text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500'

function Choice({ checked, onSelect, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex h-10 min-w-[64px] items-center justify-center rounded-lg border px-4 text-sm font-medium',
        checked
          ? 'border-indigo-600 bg-indigo-600/[.18] text-indigo-200'
          : 'border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800',
      )}
    >
      {children}
    </button>
  )
}

function PreparingDialog({ count, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Preparing your session"
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-2xl border border-slate-700 bg-slate-900 p-6"
      >
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-indigo-300 motion-reduce:animate-none" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-50">Preparing your session</h2>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm text-slate-300">
          <li>Read your CV</li>
          <li>Match it to the job description</li>
          <li>Write {questionTotalLabel(count)}</li>
        </ul>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center self-end rounded-lg border border-slate-700 px-4 text-[13px] font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function InterviewSetup() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState('')
  const roleTouched = useRef(false)
  const [jd, setJd] = useState('')
  const [count, setCount] = useState(6)
  const [difficultyId, setDifficultyId] = useState('medium')
  const [status, setStatus] = useState('ready') // ready | starting | failed
  const [error, setError] = useState('')
  const controller = useRef(null)

  useEffect(() => {
    let active = true
    fetchProfile()
      .then((data) => {
        if (!active) return
        setProfile(data)
        if (!roleTouched.current) setRole(data.target_role ?? '')
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId)
  const jdOver = jd.length > JD_LIMIT
  const roleTrimmed = role.trim()
  const canStart = roleTrimmed.length > 0 && !jdOver && status !== 'starting'

  async function onStart() {
    controller.current = new AbortController()
    setStatus('starting')
    setError('')
    try {
      const started = await startInterview(
        { targetRole: roleTrimmed, jobDescription: jd, questionCount: count, difficulties: difficulty.api },
        { signal: controller.current.signal },
      )
      const state = createSession({ started, role: roleTrimmed })
      saveSession(state)
      navigate(`/interview/${started.session_id}`)
    } catch (err) {
      if (err.code === 'ERR_CANCELED') {
        setStatus('ready')
        return
      }
      setError(describeInterviewError(err))
      setStatus('failed')
    }
  }

  const summaryRows = [
    ['Type', 'Tech Interview'],
    ['Role', roleTrimmed || 'Not set'],
    ['CV', profile ? (profile.has_cv ? 'On file' : 'Not uploaded') : '…'],
    ['Job description', jd.trim() ? `${jd.length} characters` : 'Not added'],
    ['Questions', String(count)],
    ['Difficulty', difficulty.label],
    ['Estimated time', `About ${estimatedMinutes(count)} min`],
  ]

  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-50">Set up your session</h1>
        <p className="m-0 text-sm text-slate-400">
          Choose what to practise. Paste the job description and the questions will follow it.
        </p>
      </div>

      {profile && !profile.has_cv && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/[.08] px-4 py-3 text-[13px] text-amber-200">
          <AlertTriangle className="size-4 flex-none text-amber-400" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            No CV on file, so questions will be general. Upload one to get questions about your own projects.
          </span>
          <Link
            to="/profile"
            className="inline-flex h-9 items-center rounded-lg border border-amber-500/50 px-3 text-[13px] font-semibold text-amber-300 hover:bg-amber-500/[.14]"
          >
            Upload CV
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <Caption>Session type</Caption>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 rounded-xl border border-indigo-600 bg-indigo-600/[.12] p-4">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                  <SquareTerminal className="size-4 text-indigo-300" aria-hidden="true" />
                  Tech Interview
                </span>
                <span className="text-[13px] text-slate-300">
                  Technical questions by text, with follow-ups when an answer is thin.
                </span>
              </div>
              <Link
                to="/english"
                className="flex flex-col gap-1.5 rounded-xl border border-slate-700 p-4 hover:border-slate-600 hover:bg-slate-800/60"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                  <PenLine className="size-4 text-slate-300" aria-hidden="true" />
                  Tech Daily Standup
                </span>
                <span className="text-[13px] text-slate-400">
                  Give a short English update on your work, then get it graded for clarity and grammar.
                </span>
              </Link>
            </div>
          </Card>

          <Card className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="setup-role" className="text-sm font-semibold text-slate-100">
                Target role
              </label>
              <input
                id="setup-role"
                type="text"
                value={role}
                maxLength={100}
                onChange={(e) => {
                  roleTouched.current = true
                  setRole(e.target.value)
                }}
                className={fieldClass}
              />
              <span className="text-xs text-slate-400">Prefilled from your profile.</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="setup-jd" className="text-sm font-semibold text-slate-100">
                  Job description <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <span className={cn('font-mono text-xs', jdOver ? 'text-rose-400' : 'text-slate-400')}>
                  {jd.length.toLocaleString('en-US')} / {JD_LIMIT.toLocaleString('en-US')}
                </span>
              </div>
              <textarea
                id="setup-jd"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                aria-invalid={jdOver}
                className={cn(fieldClass, 'min-h-[180px] resize-y', jdOver && 'border-rose-500')}
              />
              <span className={cn('text-xs', jdOver ? 'text-rose-400' : 'text-slate-400')}>
                {jdOver
                  ? 'That is over the limit. Trim it to the responsibilities and requirements.'
                  : 'Without a posting, questions follow your role and CV only.'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span id="count-label" className="text-sm font-semibold text-slate-100">
                Number of questions
              </span>
              <div role="radiogroup" aria-labelledby="count-label" className="flex flex-wrap gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <Choice key={n} checked={count === n} onSelect={() => setCount(n)}>
                    {n}
                  </Choice>
                ))}
              </div>
              <span className="text-xs text-slate-400">About 3 minutes per question, follow-ups included.</span>
            </div>

            <div className="flex flex-col gap-2">
              <span id="difficulty-label" className="text-sm font-semibold text-slate-100">
                Difficulty
              </span>
              <div role="radiogroup" aria-labelledby="difficulty-label" className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Choice key={d.id} checked={difficultyId === d.id} onSelect={() => setDifficultyId(d.id)}>
                    {d.label}
                  </Choice>
                ))}
              </div>
              <span className="text-xs text-slate-400">{difficulty.help}</span>
            </div>
          </Card>
        </div>

        <section aria-label="Session summary" className="min-w-0 flex-[1_1_300px]">
          <Card className="flex flex-col gap-4 p-5">
            <Caption>Session summary</Caption>
            <dl className="m-0 flex flex-col gap-2.5">
              {summaryRows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="m-0 text-right font-medium text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
            {status === 'failed' && (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/40 bg-rose-500/[.08] px-3.5 py-3 text-[13px] leading-normal text-rose-300"
              >
                <p className="m-0 font-semibold">Could not start the session.</p>
                <p className="m-0 mt-1">{error} Your settings are kept, so you can try again.</p>
              </div>
            )}
            <button
              type="button"
              disabled={!canStart}
              onClick={onStart}
              className="inline-flex h-[46px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              <Mic className="size-4" aria-hidden="true" />
              {status === 'failed' ? 'Try again' : 'Start session'}
            </button>
          </Card>
        </section>
      </div>

      {status === 'starting' && <PreparingDialog count={count} onCancel={() => controller.current?.abort()} />}
    </div>
  )
}
