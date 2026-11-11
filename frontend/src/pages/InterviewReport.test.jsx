import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createFlashcard } from '@/api/flashcards'
import { fetchReport } from '@/api/interview'
import InterviewReport from './InterviewReport'

vi.mock('@/api/interview', async (importOriginal) => ({ ...(await importOriginal()), fetchReport: vi.fn() }))
vi.mock('@/api/flashcards', () => ({ createFlashcard: vi.fn() }))

const plain = (text) => ({ text, kind: null })

const REPORT = {
  session_id: 7,
  target_role: 'Java Backend Developer',
  status: 'COMPLETED',
  started_at: '2026-11-10T03:53:13',
  duration_seconds: 330,
  finished_early: true,
  answered_questions: 2,
  total_questions: 6,
  overall_score: 82,
  communication_score: 88,
  headline: 'Nền tảng tốt',
  summary: 'Vững về cơ sở dữ liệu.',
  star: { percent: 75, situation: true, task: true, action: true, result: false, note: 'Kết quả chưa được định lượng.' },
  strengths: [{ title: 'Database indexing', text: 'Nêu đúng đánh đổi.' }],
  gaps: [
    { title: 'Race conditions', level: 'High', text: 'Chưa nói về atomics.' },
    { title: 'Composite indexes', level: 'Medium', text: 'Chưa xét thứ tự cột.' },
  ],
  comparison: { previous_average: 76, previous_sessions: 3, delta: 6 },
  questions: [
    {
      number: 1,
      category: 'OOP',
      difficulty: 'MID',
      question: 'What is a design pattern?',
      score: 90,
      communication_score: 90,
      tags: [{ text: 'Đúng định nghĩa', tone: 'good' }],
      turns: [
        { type: 'MAIN_QUESTION', question: 'What is a design pattern?', answer: 'A reusable solution.', technical_score: 90, clarity_score: 90, critique: 'Chính xác.' },
      ],
      your_answer: [plain('A reusable solution.')],
      reference_answer: [plain('A named, reusable solution.')],
      mistake_card: null,
    },
    {
      number: 2,
      category: 'SQL',
      difficulty: 'MID',
      question: 'Why does an index speed up reads?',
      score: 66,
      communication_score: 80,
      tags: [
        { text: 'Đúng B-tree', tone: 'good' },
        { text: 'Thiếu chi phí ghi', tone: 'warn' },
        { text: 'Sai về hash', tone: 'bad' },
      ],
      turns: [
        { type: 'MAIN_QUESTION', question: 'Why does an index speed up reads?', answer: 'It is a sorted thing. It worked.', technical_score: 60, clarity_score: 80, critique: 'Thiếu chi phí ghi.' },
        { type: 'FOLLOW_UP', question: 'What does it cost?', answer: 'Slower writes.', technical_score: 72, clarity_score: 80, critique: 'Đúng một phần.' },
      ],
      your_answer: [
        plain('It is a '),
        { text: 'sorted thing', kind: 'gap' },
        plain('. '),
        { text: 'It worked.', kind: 'error' },
      ],
      reference_answer: [plain('Keys stay '), { text: 'sorted', kind: 'key' }, plain(', so reads are fast.')],
      mistake_card: { front: 'Cost of an index?', back: 'Slower writes.' },
    },
  ],
}

const httpError = (status, code) => Object.assign(new Error('x'), { response: { status, data: { error: { code } }, headers: {} } })

function renderReport({ state } = {}) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[{ pathname: '/interview/7/report', state }]}>
      <Routes>
        <Route path="/interview/:sessionId/report" element={<InterviewReport />} />
        <Route path="/interview" element={<p>Setup page</p>} />
        <Route path="/interview/:sessionId" element={<p>Room page</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return user
}

const headers = () => screen.getAllByRole('button', { name: /^Q\d/ })
const openOnes = () => headers().filter((h) => h.getAttribute('aria-expanded') === 'true')

beforeEach(() => {
  fetchReport.mockReset().mockResolvedValue(REPORT)
  createFlashcard.mockReset().mockResolvedValue({ id: 1 })
})

// --- loading the report ---

test('a report handed over by the room is shown without fetching it again', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByRole('heading', { level: 1, name: 'Interview Evaluation Report' })).toBeInTheDocument()
  expect(fetchReport).not.toHaveBeenCalled()
})

test('a report opened directly is fetched, with a loading state first', async () => {
  renderReport()

  expect(screen.getByRole('status')).toHaveTextContent(/Loading your report/)
  expect(await screen.findByRole('heading', { level: 1, name: 'Interview Evaluation Report' })).toBeInTheDocument()
  expect(fetchReport).toHaveBeenCalledWith('7')
})

test('a report that does not exist says so and links back to setup', async () => {
  fetchReport.mockRejectedValue(httpError(404, 'SESSION_NOT_FOUND'))
  renderReport()

  expect(await screen.findByRole('heading', { level: 1, name: 'Report not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Start a new session' })).toHaveAttribute('href', '/interview')
})

test('an interview that is not finished yet links back to its room', async () => {
  fetchReport.mockRejectedValue(httpError(409, 'REPORT_NOT_READY'))
  renderReport()

  expect(await screen.findByText(/has not been finished/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to the interview' })).toHaveAttribute('href', '/interview/7')
})

test('a failed load can be retried', async () => {
  fetchReport.mockRejectedValueOnce(httpError(503, 'AI_UNAVAILABLE')).mockResolvedValueOnce(REPORT)
  const user = renderReport()

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Interview Evaluation Report' })).toBeInTheDocument()
})

// --- header and summary ---

test('the header shows the role, the questions answered, the duration and the date', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByText('Java Backend Developer')).toBeInTheDocument()
  expect(screen.getByText('2 of 6 questions · 05:30 · Nov 10, 2026')).toBeInTheDocument()
  expect(screen.getByText('Finished early')).toBeInTheDocument()
})

test('a full interview is not marked as finished early', () => {
  renderReport({ state: { report: { ...REPORT, finished_early: false, answered_questions: 6 } } })

  expect(screen.queryByText('Finished early')).not.toBeInTheDocument()
})

test('retaking goes back to the setup screen', async () => {
  const user = renderReport({ state: { report: REPORT } })

  await user.click(screen.getByRole('link', { name: 'Retake interview' }))

  expect(screen.getByText('Setup page')).toBeInTheDocument()
})

test('the summary shows the score ring, headline, summary and the comparison', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByRole('img', { name: '82 out of 100' })).toBeInTheDocument()
  expect(screen.getByText('Nền tảng tốt')).toBeInTheDocument()
  expect(screen.getByText('Vững về cơ sở dữ liệu.')).toBeInTheDocument()
  expect(screen.getByText('+6 vs your 76 average')).toBeInTheDocument()
})

test('STAR shows the percentage, the four letters and the note', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByText('STAR method compliance')).toBeInTheDocument()
  expect(screen.getByText('75%')).toBeInTheDocument()
  for (const letter of ['S', 'T', 'A', 'R']) expect(screen.getByText(letter)).toBeInTheDocument()
  expect(screen.getByText('Kết quả chưa được định lượng.')).toBeInTheDocument()
})

test('without a behavioural question STAR is replaced by a short explanation', () => {
  renderReport({ state: { report: { ...REPORT, star: null } } })

  expect(screen.queryByText('STAR method compliance')).not.toBeInTheDocument()
  expect(screen.getByText(/No behavioural question was answered/)).toBeInTheDocument()
})

test('strengths and knowledge gaps are listed, with the gap level', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByRole('heading', { name: 'Key Strengths' })).toBeInTheDocument()
  expect(screen.getByText('Database indexing')).toBeInTheDocument()
  const gap = screen.getByText('Race conditions').closest('div')
  expect(within(gap).getByText('High')).toBeInTheDocument()
  expect(within(screen.getByText('Composite indexes').closest('div')).getByText('Medium')).toBeInTheDocument()
})

// --- question breakdown ---

test('every answered question is listed with a toned score', () => {
  renderReport({ state: { report: REPORT } })

  expect(headers()).toHaveLength(2)
  expect(screen.getByText('90 / 100').className).toContain('text-emerald-400')
  expect(screen.getByText('66 / 100').className).toContain('text-amber-400')
})

test('the weakest question starts open and only one is open at a time', async () => {
  const user = renderReport({ state: { report: REPORT } })
  expect(openOnes()).toHaveLength(1)
  expect(openOnes()[0]).toHaveTextContent(/^Q2/)

  await user.click(headers()[0])

  expect(openOnes()).toHaveLength(1)
  expect(openOnes()[0]).toHaveTextContent(/^Q1/)

  await user.click(headers()[0])
  expect(openOnes()).toHaveLength(0)
})

test('an open question shows the critique tags, both answers and the follow-up exchange', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByText('Thiếu chi phí ghi')).toBeInTheDocument()
  expect(screen.getByText('Your Answer')).toBeInTheDocument()
  expect(screen.getByText('Optimal Reference Answer')).toBeInTheDocument()
  const followUp = screen.getByRole('region', { name: 'Follow-up exchange' })
  expect(within(followUp).getByText('What does it cost?')).toBeInTheDocument()
  expect(within(followUp).getByText('Slower writes.')).toBeInTheDocument()
  expect(within(followUp).getByText('Đúng một phần.')).toBeInTheDocument()
})

test('highlighted parts of the answers carry their colour', () => {
  renderReport({ state: { report: REPORT } })

  expect(screen.getByText('sorted thing').className).toContain('border-amber-500')
  expect(screen.getByText('It worked.').className).toContain('border-rose-500')
  expect(screen.getByText('sorted', { selector: 'span' }).className).toContain('border-emerald-500')
  expect(screen.getByText('It is a').className).not.toContain('border-b-2')
})

test('the question without follow-ups shows no follow-up section', async () => {
  const user = renderReport({ state: { report: REPORT } })

  await user.click(headers()[0])

  expect(screen.queryByRole('region', { name: 'Follow-up exchange' })).not.toBeInTheDocument()
})

// --- flashcards ---

test('adding to flashcards saves the AI card as a TECH_CONCEPT card and then shows it saved', async () => {
  const user = renderReport({ state: { report: REPORT } })

  await user.click(screen.getByRole('button', { name: 'Add to Mistake Flashcards' }))

  expect(createFlashcard).toHaveBeenCalledWith({
    source_type: 'TECH_CONCEPT',
    front_content: 'Cost of an index?',
    back_content: 'Slower writes.',
    explanation: 'Thiếu chi phí ghi.',
  })
  const saved = await screen.findByRole('button', { name: 'Added to Flashcards' })
  expect(saved).toBeDisabled()
})

test('a question without an AI card still offers a card made from the question and optimal answer', async () => {
  const user = renderReport({ state: { report: REPORT } })
  await user.click(headers()[0])

  await user.click(screen.getByRole('button', { name: 'Add to Mistake Flashcards' }))

  expect(createFlashcard).toHaveBeenCalledWith(
    expect.objectContaining({ front_content: 'What is a design pattern?', back_content: 'A named, reusable solution.' }),
  )
})

test('a failed save can be tried again', async () => {
  createFlashcard.mockRejectedValueOnce(new Error('x'))
  const user = renderReport({ state: { report: REPORT } })

  await user.click(screen.getByRole('button', { name: 'Add to Mistake Flashcards' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this card.')
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Added to Flashcards' })).toBeInTheDocument())
  expect(createFlashcard).toHaveBeenCalledTimes(2)
})

test('each question keeps its own save status', async () => {
  const user = renderReport({ state: { report: REPORT } })
  await user.click(screen.getByRole('button', { name: 'Add to Mistake Flashcards' }))
  await screen.findByRole('button', { name: 'Added to Flashcards' })

  await user.click(headers()[0])

  expect(screen.getByRole('button', { name: 'Add to Mistake Flashcards' })).toBeEnabled()
})
