import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fetchPrompt } from '@/api/writing'
import WritingCoach from '@/pages/WritingCoach'
import { countWords } from '@/utils/text'

vi.mock('@/api/writing', async (importOriginal) => ({ ...(await importOriginal()), fetchPrompt: vi.fn() }))

const IELTS = {
  id: 'task2-01',
  task_type: 'IELTS_TASK2',
  prompt: 'Some people believe that technology helps learning. Discuss.',
  min_words: 250,
  max_words: null,
  suggested_minutes: 40,
}
const IELTS_2 = { ...IELTS, id: 'task2-02', prompt: 'A second IELTS prompt.' }
const STANDUP = {
  id: 'standup-01',
  task_type: 'TECH_STANDUP',
  prompt: 'Write your daily standup update.',
  min_words: 80,
  max_words: 120,
  suggested_minutes: 5,
}

const essayBox = () => screen.getByLabelText('Your essay')
const renderPage = async () => {
  render(<WritingCoach />)
  await screen.findByText(IELTS.prompt)
}

beforeEach(() => {
  localStorage.clear()
  fetchPrompt.mockReset()
  fetchPrompt.mockImplementation(async (task) => (task === 'standup' ? STANDUP : IELTS))
})

test('loads the prompt from the API with its length note and minimum words', async () => {
  await renderPage()
  expect(fetchPrompt).toHaveBeenCalledWith('ielts')
  expect(screen.getByText('Write at least 250 words. Suggested time: 40 minutes.')).toBeInTheDocument()
  expect(screen.getByText('min 250')).toBeInTheDocument()
})

test('shows a loading state before the prompt arrives', () => {
  fetchPrompt.mockReturnValue(new Promise(() => {}))
  render(<WritingCoach />)
  expect(screen.getByText('Loading prompt...')).toBeInTheDocument()
  expect(screen.getByRole('timer', { name: 'Time remaining' })).toHaveTextContent('--:--')
})

test('the countdown starts from the prompt time and counts down', async () => {
  // Only the interval is faked, so findBy's own polling keeps working.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  try {
    await renderPage()
    const timer = screen.getByRole('timer', { name: 'Time remaining' })
    expect(timer).toHaveTextContent('40:00')
    expect(screen.getByText('of 40:00')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(timer).toHaveTextContent('39:59')
  } finally {
    vi.useRealTimers()
  }
})

test('the standup task uses its own time and word range', async () => {
  const user = userEvent.setup()
  await renderPage()
  await user.click(screen.getByRole('button', { name: 'Tech Daily Standup' }))

  expect(await screen.findByText(STANDUP.prompt)).toBeInTheDocument()
  expect(fetchPrompt).toHaveBeenLastCalledWith('standup')
  expect(screen.getByRole('timer', { name: 'Time remaining' })).toHaveTextContent('05:00')
  expect(screen.getByText('Write 80 to 120 words. Suggested time: 5 minutes.')).toBeInTheDocument()
  expect(screen.getByText('min 80')).toBeInTheDocument()
})

test('New prompt loads a different prompt and restarts the countdown', async () => {
  const user = userEvent.setup()
  await renderPage()
  fetchPrompt.mockResolvedValueOnce(IELTS).mockResolvedValueOnce(IELTS_2)

  await user.click(screen.getByRole('button', { name: 'New prompt' }))

  expect(await screen.findByText(IELTS_2.prompt)).toBeInTheDocument()
  expect(screen.queryByText(IELTS.prompt)).not.toBeInTheDocument()
  expect(screen.getByRole('timer', { name: 'Time remaining' })).toHaveTextContent('40:00')
})

test('a failed first load offers Try again', async () => {
  const user = userEvent.setup()
  fetchPrompt.mockRejectedValueOnce(new Error('down'))
  render(<WritingCoach />)

  expect(await screen.findByText("Couldn't load a prompt.")).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(IELTS.prompt)).toBeInTheDocument()
})

test('a failed New prompt keeps the current prompt and says so', async () => {
  const user = userEvent.setup()
  await renderPage()
  fetchPrompt.mockRejectedValueOnce(new Error('down'))

  await user.click(screen.getByRole('button', { name: 'New prompt' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Keeping the current one')
  expect(screen.getByText(IELTS.prompt)).toBeInTheDocument()
})

test('typing updates the word count with the matching color', async () => {
  const user = userEvent.setup()
  await renderPage()
  await user.type(essayBox(), 'one two three four five')

  const count = screen.getByText(`${countWords(essayBox().value)} words`)
  expect(count).toBeInTheDocument()
  expect(count.className).toContain('text-amber-400')
})

test('a draft saved earlier is restored and shown as saved', async () => {
  localStorage.setItem('writing-draft:ielts', 'restored draft text')
  await renderPage()
  expect(essayBox().value).toBe('restored draft text')
  expect(screen.getByText('Draft saved')).toBeInTheDocument()
})

test('typing shows Draft saved a few seconds later', async () => {
  const user = userEvent.setup()
  await renderPage()
  await user.type(essayBox(), 'hello')
  expect(screen.queryByText('Draft saved')).not.toBeInTheDocument()
  expect(screen.getByText('Saving draft...')).toBeInTheDocument()

  expect(await screen.findByText('Draft saved', {}, { timeout: 4000 })).toBeInTheDocument()
  expect(localStorage.getItem('writing-draft:ielts')).toBe('hello')
})

test('each task keeps its own draft', async () => {
  localStorage.setItem('writing-draft:ielts', 'ielts draft')
  localStorage.setItem('writing-draft:standup', 'standup draft')
  const user = userEvent.setup()
  await renderPage()

  await user.click(screen.getByRole('button', { name: 'Tech Daily Standup' }))
  await screen.findByText(STANDUP.prompt)

  expect(essayBox().value).toBe('standup draft')
})

test('the prompt accordion collapses and expands', async () => {
  const user = userEvent.setup()
  await renderPage()
  const toggle = screen.getByRole('button', { name: /Prompt topic/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await user.click(toggle)
  expect(screen.queryByText(IELTS.prompt)).not.toBeInTheDocument()
  await user.click(toggle)
  expect(screen.getByText(IELTS.prompt)).toBeInTheDocument()
})
