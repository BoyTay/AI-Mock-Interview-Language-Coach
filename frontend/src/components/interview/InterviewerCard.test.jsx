import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewerCard from './InterviewerCard'

const moving = (container) => /animate-/.test(container.querySelector('[aria-hidden="true"] i').className)

test('speaking shows the Speaking badge and moves the waveform', () => {
  const { container } = render(<InterviewerCard state="speaking" />)

  expect(screen.getByText('Speaking')).toBeInTheDocument()
  expect(moving(container)).toBe(true)
})

test('waiting keeps the waveform still', () => {
  const { container } = render(<InterviewerCard state="waiting" />)

  expect(screen.getByText('Waiting for you')).toBeInTheDocument()
  expect(moving(container)).toBe(false)
})

test('without speech support there is no prompt and no controls', () => {
  render(<InterviewerCard state="waiting" readAloud={null} canReplay />)

  expect(screen.queryByText('Read questions aloud?')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Read questions aloud' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Replay question/ })).not.toBeInTheDocument()
})

test('first time it asks, and each answer reports the choice', async () => {
  const user = userEvent.setup()
  const onReadAloudChange = vi.fn()
  render(<InterviewerCard state="waiting" speechSupported readAloud={null} onReadAloudChange={onReadAloudChange} canReplay />)

  expect(screen.getByText('Read questions aloud?')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Replay question/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Read aloud' }))
  expect(onReadAloudChange).toHaveBeenLastCalledWith('on')
  await user.click(screen.getByRole('button', { name: 'Keep silent' }))
  expect(onReadAloudChange).toHaveBeenLastCalledWith('off')
})

test('once chosen it shows the toggle and replay instead of the prompt', async () => {
  const user = userEvent.setup()
  const onReadAloudChange = vi.fn()
  const onReplay = vi.fn()
  render(
    <InterviewerCard
      state="waiting"
      speechSupported
      readAloud="on"
      onReadAloudChange={onReadAloudChange}
      onReplay={onReplay}
      canReplay
    />,
  )

  expect(screen.queryByText('Read questions aloud?')).not.toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: 'Read questions aloud' })
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await user.click(toggle)
  expect(onReadAloudChange).toHaveBeenCalledWith('off')
  await user.click(screen.getByRole('button', { name: /Replay question/ }))
  expect(onReplay).toHaveBeenCalledTimes(1)
})

test('a muted toggle turns reading back on', async () => {
  const user = userEvent.setup()
  const onReadAloudChange = vi.fn()
  render(<InterviewerCard state="waiting" speechSupported readAloud="off" onReadAloudChange={onReadAloudChange} canReplay />)

  const toggle = screen.getByRole('button', { name: 'Read questions aloud' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await user.click(toggle)
  expect(onReadAloudChange).toHaveBeenCalledWith('on')
})

test('replay is disabled without a question', () => {
  render(<InterviewerCard state="done" speechSupported readAloud="on" canReplay={false} />)

  expect(screen.getByRole('button', { name: /Replay question/ })).toBeDisabled()
})
