import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { describeInterviewError, fetchReport } from '@/api/interview'
import Badge from '@/components/common/Badge'
import QuestionBreakdown from '@/components/interview/QuestionBreakdown'
import ReportSummary from '@/components/interview/ReportSummary'
import { formatMmSs } from '@/utils/time'

const primaryLink =
  'inline-flex h-[42px] items-center justify-center whitespace-nowrap rounded-lg bg-indigo-600 px-[18px] text-sm font-semibold text-white hover:bg-indigo-700'
const ghostLink =
  'inline-flex h-[42px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-700 px-[18px] text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800'

function Notice({ title, children, actions }) {
  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      <h1 className="text-[26px] font-bold tracking-tight text-slate-50">{title}</h1>
      <div className="text-sm leading-normal text-slate-400">{children}</div>
      <div className="flex flex-wrap gap-2.5">{actions}</div>
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function metaLine(report) {
  const parts = [`${report.answered_questions} of ${report.total_questions} questions`]
  if (report.duration_seconds != null) parts.push(formatMmSs(report.duration_seconds))
  if (report.started_at) parts.push(formatDate(report.started_at))
  return parts.join(' · ')
}

export default function InterviewReport() {
  const { sessionId } = useParams()
  const location = useLocation()
  const handedOver = location.state?.report ?? null
  const [report, setReport] = useState(handedOver)
  const [failure, setFailure] = useState(null) // { status, code, message }

  const load = useCallback(() => {
    setFailure(null)
    return fetchReport(sessionId).then(setReport, (err) =>
      setFailure({
        status: err.response?.status,
        code: err.response?.data?.error?.code,
        message: describeInterviewError(err),
      }),
    )
  }, [sessionId])

  useEffect(() => {
    if (!handedOver) load()
  }, [handedOver, load])

  if (failure?.status === 404) {
    return (
      <Notice
        title="Report not found"
        actions={
          <Link to="/interview" className={primaryLink}>
            Start a new session
          </Link>
        }
      >
        {failure.message}
      </Notice>
    )
  }
  if (failure?.code === 'REPORT_NOT_READY') {
    return (
      <Notice
        title="Report not ready"
        actions={
          <Link to={`/interview/${sessionId}`} className={primaryLink}>
            Back to the interview
          </Link>
        }
      >
        This interview has not been finished yet, so there is no report. End the session from the interview room to get
        one.
      </Notice>
    )
  }
  if (failure) {
    return (
      <Notice
        title="Could not load the report"
        actions={
          <button type="button" onClick={load} className={primaryLink}>
            Try again
          </button>
        }
      >
        <p role="alert" className="m-0">
          {failure.message}
        </p>
      </Notice>
    )
  }
  if (!report) {
    return (
      <div role="status" className="flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Loading your report…
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-tight text-slate-50">Interview Evaluation Report</h1>
          <div className="flex flex-wrap items-center gap-2.5">
            {report.target_role && <Badge tone="i">{report.target_role}</Badge>}
            <span className="font-mono text-[13px] text-slate-400">{metaLine(report)}</span>
            {report.finished_early && <Badge tone="a">Finished early</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/interview" className={primaryLink}>
            Retake interview
          </Link>
        </div>
      </div>
      <ReportSummary report={report} />
      <QuestionBreakdown questions={report.questions} />
    </div>
  )
}
