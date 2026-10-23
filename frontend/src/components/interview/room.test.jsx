import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewRoom from '@/pages/InterviewRoom'

test('shows the session role, question counter and progress', () => {
  const { container } = render(<InterviewRoom />)
  expect(screen.getByText('Java/Python Backend Intern')).toBeInTheDocument()
  expect(screen.getByText('Question 3 of 6')).toBeInTheDocument()
  const bars = container.querySelector('[aria-label="Progress: 2 answered, question 3 in progress"]')
  expect(bars.children).toHaveLength(6)
  expect(bars.querySelectorAll('.bg-indigo-600')).toHaveLength(2)
})

test('the elapsed timer starts at 12:48 and ticks', () => {
  vi.useFakeTimers()
  try {
    render(<InterviewRoom />)
    const timer = screen.getByRole('timer', { name: 'Elapsed time' })
    expect(timer).toHaveTextContent('12:48')
    act(() => vi.advanceTimersByTime(2000))
    expect(timer).toHaveTextContent('12:50')
  } finally {
    vi.useRealTimers()
  }
})

test('the hint is collapsed by default and toggles', async () => {
  const user = userEvent.setup()
  render(<InterviewRoom />)
  const toggle = screen.getByRole('button', { name: /Show Hint \/ Key Concepts/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Index column order')).not.toBeInTheDocument()

  await user.click(toggle)
  expect(screen.getByText('Index column order')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Hide Hint \/ Key Concepts/ })).toHaveAttribute('aria-expanded', 'true')
})

test('the answer dock starts in Voice and switches to Text & Code', async () => {
  const user = userEvent.setup()
  render(<InterviewRoom />)
  expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Voice' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'Text & Code' }))
  expect(screen.getByLabelText('Type your answer')).toBeInTheDocument()
  const codeToggle = screen.getByRole('button', { name: 'Code block' })
  expect(codeToggle).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Code snippet')).toBeInTheDocument()

  await user.click(codeToggle)
  expect(screen.queryByLabelText('Code snippet')).not.toBeInTheDocument()
})

test('the transcript lists five messages and the last one awaits an answer', () => {
  render(<InterviewRoom />)
  const log = screen.getByRole('log', { name: 'Live transcript' })
  expect(within(log).getAllByRole('article')).toHaveLength(5)
  expect(within(log).getByText(/awaiting your answer/)).toBeInTheDocument()
})
