import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { essayFromSegments, prompts, segments } from '@/mocks/writing'
import WritingCoach from '@/pages/WritingCoach'
import { countWords } from '@/utils/text'

const essayBox = () => screen.getByLabelText('Your essay')

test('shows the real word count of the sample essay with the matching color', () => {
  render(<WritingCoach />)
  const n = countWords(essayFromSegments(segments))
  const count = screen.getByText(`${n} words`)
  expect(count.className).toContain(n >= 250 ? 'text-emerald-400' : 'text-amber-400')
  expect(screen.getByText('min 250')).toBeInTheDocument()
})

test('an emptied essay shows 0 words in the amber style', async () => {
  const user = userEvent.setup()
  render(<WritingCoach />)
  await user.clear(essayBox())
  const count = screen.getByText('0 words')
  expect(count.className).toContain('text-amber-400')
})

test('typing updates the word count', async () => {
  const user = userEvent.setup()
  render(<WritingCoach />)
  await user.clear(essayBox())
  await user.type(essayBox(), 'one two three four five')
  expect(screen.getByText('5 words')).toBeInTheDocument()
})

test('the countdown starts at 17:42 and counts down', () => {
  vi.useFakeTimers()
  try {
    render(<WritingCoach />)
    const timer = screen.getByRole('timer', { name: 'Time remaining' })
    expect(timer).toHaveTextContent('17:42')
    act(() => vi.advanceTimersByTime(1000))
    expect(timer).toHaveTextContent('17:41')
    expect(screen.getByText('of 40:00')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('switching task swaps the prompt and keeps the essay', async () => {
  const user = userEvent.setup()
  render(<WritingCoach />)
  expect(screen.getByText(prompts.ielts[0])).toBeInTheDocument()
  const before = essayBox().value

  await user.click(screen.getByRole('button', { name: 'Tech Daily Standup' }))
  expect(screen.getByText(prompts.standup[0])).toBeInTheDocument()
  expect(screen.queryByText(prompts.ielts[0])).not.toBeInTheDocument()
  expect(essayBox().value).toBe(before)
})

test('the prompt accordion collapses and expands', async () => {
  const user = userEvent.setup()
  render(<WritingCoach />)
  const toggle = screen.getByRole('button', { name: /Prompt topic/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await user.click(toggle)
  expect(screen.queryByText(prompts.ielts[0])).not.toBeInTheDocument()
  await user.click(toggle)
  expect(screen.getByText(prompts.ielts[0])).toBeInTheDocument()
})
