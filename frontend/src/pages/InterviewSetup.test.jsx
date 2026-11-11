import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { fetchProfile, startInterview } from '@/api/interview'
import { loadSession } from '@/utils/interviewSession'
import InterviewSetup from './InterviewSetup'

vi.mock('@/api/interview', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProfile: vi.fn(),
  startInterview: vi.fn(),
}))

const STARTED = {
  session_id: 7,
  question: { message_id: 1, type: 'MAIN_QUESTION', text: 'What is an index?', category: 'SQL', difficulty: 'MID', index: 1, total: 6 },
}

function Room() {
  return <p>Room for session {useParams().sessionId}</p>
}

function renderSetup() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/interview']}>
      <Routes>
        <Route path="/interview" element={<InterviewSetup />} />
        <Route path="/interview/:sessionId" element={<Room />} />
        <Route path="/profile" element={<p>Profile page</p>} />
        <Route path="/english" element={<p>English page</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return user
}

const start = () => screen.getByRole('button', { name: /Start session|Try again/ })
const role = () => screen.getByLabelText('Target role')
const summary = () => within(screen.getByRole('region', { name: 'Session summary' }))

beforeEach(() => {
  sessionStorage.clear()
  fetchProfile.mockReset().mockResolvedValue({ target_role: 'Java Backend Developer', has_cv: true })
  startInterview.mockReset().mockResolvedValue(STARTED)
})

test('the target role is prefilled from the profile', async () => {
  renderSetup()

  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))
  expect(screen.getByRole('heading', { level: 1, name: 'Set up your session' })).toBeInTheDocument()
})

test('a profile without a CV shows a notice with a link to upload one', async () => {
  fetchProfile.mockResolvedValue({ target_role: 'Dev', has_cv: false })
  const user = renderSetup()

  expect(await screen.findByText(/No CV on file/)).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Upload CV' }))
  expect(screen.getByText('Profile page')).toBeInTheDocument()
})

test('a profile with a CV shows no notice', async () => {
  renderSetup()

  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))
  expect(screen.queryByText(/No CV on file/)).not.toBeInTheDocument()
})

test('the daily standup option leads to the English page', async () => {
  const user = renderSetup()

  await user.click(await screen.findByRole('link', { name: /Tech Daily Standup/ }))

  expect(screen.getByText('English page')).toBeInTheDocument()
})

test('the summary follows the settings', async () => {
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))

  expect(summary().getByText('6')).toBeInTheDocument()
  expect(summary().getByText('About 18 min')).toBeInTheDocument()
  expect(summary().getByText('Not added')).toBeInTheDocument()

  await user.click(screen.getByRole('radio', { name: '10' }))
  await user.click(screen.getByRole('radio', { name: 'Hard' }))
  await user.type(screen.getByLabelText(/Job description/), 'Spring Boot')

  expect(summary().getByText('10')).toBeInTheDocument()
  expect(summary().getByText('About 30 min')).toBeInTheDocument()
  expect(summary().getByText('Hard')).toBeInTheDocument()
  expect(summary().getByText('11 characters')).toBeInTheDocument()
})

test('the difficulty explains itself', async () => {
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))

  expect(screen.getByText(/Typical intern interview/)).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Easy' }))
  expect(screen.getByText(/Core definitions and common patterns/)).toBeInTheDocument()
})

test('the job description counts its characters and blocks starting when over the limit', async () => {
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))
  const jd = screen.getByLabelText(/Job description/)

  await user.click(jd)
  await user.paste('a'.repeat(6001))

  expect(screen.getByText('6,001 / 6,000')).toBeInTheDocument()
  expect(screen.getByText(/over the limit/)).toBeInTheDocument()
  expect(start()).toBeDisabled()
})

test('a blank role blocks starting', async () => {
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))

  await user.clear(role())

  expect(start()).toBeDisabled()
})

test('starting sends the settings, keeps the session and opens the room', async () => {
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))
  await user.click(screen.getByRole('radio', { name: '8' }))
  await user.click(screen.getByRole('radio', { name: 'Easy' }))
  await user.type(screen.getByLabelText(/Job description/), 'Spring Boot')

  await user.click(start())

  expect(await screen.findByText('Room for session 7')).toBeInTheDocument()
  expect(startInterview).toHaveBeenCalledWith(
    { targetRole: 'Java Backend Developer', jobDescription: 'Spring Boot', questionCount: 8, difficulties: ['JUNIOR'] },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(loadSession(7)).toMatchObject({ sessionId: 7, role: 'Java Backend Developer', total: 6 })
})

test('while starting it shows the preparing steps and can be cancelled', async () => {
  let abort
  startInterview.mockImplementation(
    (_, { signal }) =>
      new Promise((_resolve, reject) => {
        abort = () => reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
        signal.addEventListener('abort', abort)
      }),
  )
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))

  await user.click(start())

  const dialog = screen.getByRole('dialog', { name: 'Preparing your session' })
  expect(within(dialog).getByText('Read your CV')).toBeInTheDocument()
  expect(within(dialog).getByText('Write 6 questions')).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(role()).toHaveValue('Java Backend Developer')
})

test('a failed start explains why, keeps the settings and offers to try again', async () => {
  startInterview.mockRejectedValueOnce(
    Object.assign(new Error('x'), { response: { status: 429, data: {}, headers: { 'retry-after': '20' } } }),
  )
  const user = renderSetup()
  await waitFor(() => expect(role()).toHaveValue('Java Backend Developer'))
  await user.click(screen.getByRole('radio', { name: '10' }))

  await user.click(start())

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(/busy/i)
  expect(alert).toHaveTextContent('20 seconds')
  expect(screen.getByRole('radio', { name: '10' })).toBeChecked()
  expect(start()).toHaveTextContent('Try again')

  await user.click(start())

  expect(await screen.findByText('Room for session 7')).toBeInTheDocument()
})
