import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { finishInterview, submitAnswer } from '@/api/interview'
import { createSession, loadSession, saveSession } from '@/utils/interviewSession'
import InterviewRoom from './InterviewRoom'

vi.mock('@/api/interview', async (importOriginal) => ({
  ...(await importOriginal()),
  submitAnswer: vi.fn(),
  finishInterview: vi.fn(),
}))

const question = (overrides = {}) => ({
  message_id: 1,
  type: 'MAIN_QUESTION',
  text: 'What is an index?',
  category: 'SQL',
  difficulty: 'MID',
  index: 1,
  total: 6,
  ...overrides,
})

const seed = (overrides = {}) =>
  saveSession({
    ...createSession({ started: { session_id: 7, question: question() }, role: 'Java Backend Developer', now: Date.now() }),
    ...overrides,
  })

function Where() {
  const location = useLocation()
  return <p>At {location.pathname}</p>
}

function renderRoom(path = '/interview/7') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/interview/:sessionId" element={<InterviewRoom />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
  return user
}

const answerBox = () => screen.getByLabelText('Type your answer')
const send = () => screen.getByRole('button', { name: /Send answer|Sending/ })
const log = () => within(screen.getByRole('log', { name: 'Live transcript' }))
const next = (overrides = {}, complete = false) => ({
  evaluation: {},
  next_question: complete ? null : question({ message_id: 2, text: 'What is a join?', index: 2, ...overrides }),
  session_complete: complete,
})
const httpError = (status, headers = {}) =>
  Object.assign(new Error('x'), { response: { status, data: {}, headers } })

beforeEach(() => {
  sessionStorage.clear()
  submitAnswer.mockReset()
  finishInterview.mockReset()
  seed()
})

test('shows the role, the question counter, the progress and the question', () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/interview/7']}>
      <Routes>
        <Route path="/interview/:sessionId" element={<InterviewRoom />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('Java Backend Developer')).toBeInTheDocument()
  expect(screen.getByText('Question 1 of 6')).toBeInTheDocument()
  const bars = container.querySelector('[aria-label="Progress: 0 answered, question 1 in progress"]')
  expect(bars.children).toHaveLength(6)
  expect(screen.getByRole('heading', { level: 2, name: 'What is an index?' })).toBeInTheDocument()
  expect(screen.getByText('SQL', { selector: 'span.font-mono' })).toBeInTheDocument()
})

test('the transcript starts with the first question awaiting an answer', () => {
  renderRoom()

  expect(log().getAllByRole('article')).toHaveLength(1)
  expect(log().getByText('What is an index?')).toBeInTheDocument()
  expect(log().getByText(/awaiting your answer/)).toBeInTheDocument()
})

test('the elapsed timer continues from when the session started and ticks', () => {
  vi.useFakeTimers()
  try {
    seed({ startedAt: Date.now() - 125000 })
    renderRoom()
    const timer = screen.getByRole('timer', { name: 'Elapsed time' })
    expect(timer).toHaveTextContent('02:05')
    act(() => vi.advanceTimersByTime(2000))
    expect(timer).toHaveTextContent('02:07')
  } finally {
    vi.useRealTimers()
  }
})

test('the answer box is plain text and code with no voice mode', () => {
  renderRoom()

  expect(answerBox()).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Voice' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument()
})

test('the code block can be added and removed', async () => {
  const user = renderRoom()
  const toggle = screen.getByRole('button', { name: 'Code block' })
  expect(screen.queryByLabelText('Code snippet')).not.toBeInTheDocument()

  await user.click(toggle)
  expect(screen.getByLabelText('Code snippet')).toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-pressed', 'true')

  await user.click(toggle)
  expect(screen.queryByLabelText('Code snippet')).not.toBeInTheDocument()
})

test('the hint area is not shown because the API gives no hints', () => {
  renderRoom()

  expect(screen.queryByRole('button', { name: /Hint/ })).not.toBeInTheDocument()
})

test('sending is disabled while the answer is empty', async () => {
  const user = renderRoom()
  expect(send()).toBeDisabled()

  await user.type(answerBox(), '   ')
  expect(send()).toBeDisabled()

  await user.type(answerBox(), 'Real words')
  expect(send()).toBeEnabled()
})

test('sending an answer shows it, then the next question and moves the counter on', async () => {
  submitAnswer.mockResolvedValue(next())
  const user = renderRoom()

  await user.type(answerBox(), 'It speeds up reads.')
  await user.click(send())

  expect(submitAnswer).toHaveBeenCalledWith(7, 'It speeds up reads.')
  expect(await screen.findByText('Question 2 of 6')).toBeInTheDocument()
  expect(log().getAllByRole('article')).toHaveLength(3)
  expect(log().getByText('It speeds up reads.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'What is a join?' })).toBeInTheDocument()
  expect(answerBox()).toHaveValue('')
  expect(loadSession(7).transcript).toHaveLength(3)
})

test('a code snippet is sent in a fenced block after the text', async () => {
  submitAnswer.mockResolvedValue(next())
  const user = renderRoom()

  await user.type(answerBox(), 'Use a composite index.')
  await user.click(screen.getByRole('button', { name: 'Code block' }))
  await user.type(screen.getByLabelText('Code snippet'), 'CREATE INDEX i ON t (a);')
  await user.click(send())

  expect(submitAnswer).toHaveBeenCalledWith(7, 'Use a composite index.\n\n```\nCREATE INDEX i ON t (a);\n```')
})

test('while the AI is working the room shows it and blocks a second send', async () => {
  let resolve
  submitAnswer.mockReturnValue(new Promise((r) => (resolve = r)))
  const user = renderRoom()
  await user.type(answerBox(), 'My answer')

  await user.click(send())

  expect(screen.getByRole('status')).toHaveTextContent(/AI is thinking/i)
  expect(send()).toBeDisabled()
  expect(send()).toHaveTextContent('Sending')

  await act(async () => resolve(next()))

  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
})

test('a follow-up is labelled and keeps the question number', async () => {
  submitAnswer.mockResolvedValue(
    next({ type: 'FOLLOW_UP', text: 'What about writes?', index: 1, message_id: 2 }),
  )
  const user = renderRoom()

  await user.type(answerBox(), 'Fast reads.')
  await user.click(send())

  expect(await screen.findByText('Follow-up Question')).toBeInTheDocument()
  expect(screen.getByText('Question 1 of 6')).toBeInTheDocument()
  expect(log().getByText('Follow-up')).toBeInTheDocument()
})

test('a failed send explains why and keeps the typed answer so it can be resent', async () => {
  submitAnswer.mockRejectedValueOnce(httpError(429, { 'retry-after': '15' })).mockResolvedValueOnce(next())
  const user = renderRoom()
  await user.type(answerBox(), 'My answer')

  await user.click(send())

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('15 seconds')
  expect(answerBox()).toHaveValue('My answer')
  expect(log().getAllByRole('article')).toHaveLength(1)

  await user.click(send())

  expect(await screen.findByText('Question 2 of 6')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('after the last answer the room offers to finish and hides the answer box', async () => {
  submitAnswer.mockResolvedValue(next({}, true))
  const user = renderRoom()

  await user.type(answerBox(), 'Last answer')
  await user.click(send())

  expect(await screen.findByText('Interview complete')).toBeInTheDocument()
  expect(screen.queryByLabelText('Type your answer')).not.toBeInTheDocument()
  expect(screen.getByText('Question 6 of 6')).toBeInTheDocument()
})

test('finishing a completed interview opens its report', async () => {
  seed({ complete: true, current: null })
  finishInterview.mockResolvedValue({ overall_score: 80 })
  const user = renderRoom()

  await user.click(screen.getByRole('button', { name: 'Finish and view report' }))

  expect(finishInterview).toHaveBeenCalledWith(7)
  expect(await screen.findByText('At /interview/7/report')).toBeInTheDocument()
  expect(loadSession(7)).toBeNull()
})

test('a failed finish keeps the room and shows the reason', async () => {
  seed({ complete: true, current: null })
  finishInterview.mockRejectedValue(httpError(503))
  const user = renderRoom()

  await user.click(screen.getByRole('button', { name: 'Finish and view report' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i)
  expect(screen.getByRole('button', { name: 'Finish and view report' })).toBeEnabled()
  expect(loadSession(7)).not.toBeNull()
})

// --- End Session ---

const answeredSession = () =>
  seed({
    transcript: [
      { from: 'ai', text: 'What is an index?', followUp: false, index: 1, at: 0 },
      { from: 'user', text: 'Fast reads.', at: 1000 },
      { from: 'ai', text: 'What is a join?', followUp: false, index: 2, at: 2000 },
    ],
    current: question({ message_id: 2, text: 'What is a join?', index: 2 }),
  })

test('End Session asks for confirmation before doing anything', async () => {
  answeredSession()
  const user = renderRoom()

  await user.click(screen.getByRole('button', { name: 'End Session' }))

  const dialog = screen.getByRole('alertdialog', { name: 'End this session?' })
  expect(within(dialog).getByText(/Only the questions you have answered will be scored/)).toBeInTheDocument()
  expect(finishInterview).not.toHaveBeenCalled()
})

test('cancelling the confirmation keeps the interview going', async () => {
  answeredSession()
  const user = renderRoom()
  await user.click(screen.getByRole('button', { name: 'End Session' }))

  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Keep going' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(finishInterview).not.toHaveBeenCalled()
})

test('confirming ends the session early and opens the report', async () => {
  answeredSession()
  finishInterview.mockResolvedValue({ overall_score: 70 })
  const user = renderRoom()
  await user.click(screen.getByRole('button', { name: 'End Session' }))

  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End and see report' }))

  expect(finishInterview).toHaveBeenCalledWith(7)
  expect(await screen.findByText('At /interview/7/report')).toBeInTheDocument()
})

test('a failed end shows the reason inside the dialog and can be retried', async () => {
  answeredSession()
  finishInterview.mockRejectedValueOnce(httpError(429, { 'retry-after': '20' })).mockResolvedValueOnce({})
  const user = renderRoom()
  await user.click(screen.getByRole('button', { name: 'End Session' }))
  const dialog = () => within(screen.getByRole('alertdialog'))

  await user.click(dialog().getByRole('button', { name: 'End and see report' }))

  expect(await dialog().findByRole('alert')).toHaveTextContent('20 seconds')

  await user.click(dialog().getByRole('button', { name: 'End and see report' }))

  expect(await screen.findByText('At /interview/7/report')).toBeInTheDocument()
})

test('ending before any answer leaves without a report and without calling the API', async () => {
  const user = renderRoom()
  await user.click(screen.getByRole('button', { name: 'End Session' }))

  const dialog = within(screen.getByRole('alertdialog'))
  expect(dialog.getByText(/no report/i)).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: 'Leave session' }))

  expect(finishInterview).not.toHaveBeenCalled()
  expect(await screen.findByText('At /interview')).toBeInTheDocument()
  expect(loadSession(7)).toBeNull()
})

// --- missing session ---

test('a session this browser does not hold explains it and links back to setup', async () => {
  sessionStorage.clear()
  renderRoom()

  expect(screen.getByRole('heading', { level: 1, name: 'This interview is not available here' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Start a new session' })).toHaveAttribute('href', '/interview')
  expect(screen.getByRole('link', { name: 'View its report' })).toHaveAttribute('href', '/interview/7/report')
})
