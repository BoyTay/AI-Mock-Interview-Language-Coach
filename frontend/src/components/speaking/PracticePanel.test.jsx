import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PracticePanel, { MAX_SECONDS, MIN_SECONDS } from './PracticePanel'

vi.mock('@/components/interview/AudioPlayer', () => ({
  default: ({ blob, label }) => <div data-testid="player" data-label={label} data-size={blob?.size} />,
}))

const PROMPT = {
  id: 'p1',
  prompt: 'Give your daily standup update: what you finished yesterday.',
  min_seconds: 60,
  max_seconds: 120,
}

const readyPrompt = (extra = {}) => ({
  status: 'ready',
  prompt: PROMPT,
  round: 0,
  next: vi.fn(),
  retry: vi.fn(),
  ...extra,
})

const makeRecorder = (extra = {}) => ({
  status: 'idle',
  error: null,
  blob: null,
  mimeType: '',
  seconds: 0,
  limitReached: false,
  level: 0,
  start: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  ...extra,
})

const recorded = (seconds = 45, extra = {}) =>
  makeRecorder({ status: 'recorded', blob: new Blob(['voice']), mimeType: 'audio/webm', seconds, ...extra })

function setup(props = {}) {
  const handlers = { onEvaluate: vi.fn(), onRecordAgain: vi.fn(), onNewPrompt: vi.fn() }
  const all = {
    promptState: readyPrompt(),
    recorder: makeRecorder(),
    phase: 'idle',
    evaluateError: null,
    hasResult: false,
    ...handlers,
    ...props,
  }
  const view = render(<PracticePanel {...all} />)
  return { ...all, ...view, user: userEvent.setup() }
}

const button = (name) => screen.getByRole('button', { name })

describe('PracticePanel constants', () => {
  it('exports the recording limits', () => {
    expect(MIN_SECONDS).toBe(30)
    expect(MAX_SECONDS).toBe(120)
  })
})

describe('PracticePanel prompt', () => {
  it('shows the task label, length and prompt text', () => {
    setup()
    expect(screen.getByText('Tech Daily Standup')).toBeInTheDocument()
    expect(screen.getByText('1-2 min')).toBeInTheDocument()
    expect(screen.getByText(PROMPT.prompt)).toBeInTheDocument()
    expect(button('New prompt')).toBeEnabled()
  })

  it('shows a loading note while the prompt loads', () => {
    setup({ promptState: readyPrompt({ status: 'loading', prompt: null }) })
    expect(screen.getByText('Loading prompt...')).toBeInTheDocument()
    expect(screen.queryByText(PROMPT.prompt)).not.toBeInTheDocument()
  })

  it('offers Try again when the first prompt fails to load', async () => {
    const promptState = readyPrompt({ status: 'error', prompt: null })
    const { user } = setup({ promptState })
    expect(screen.getByText("Couldn't load a prompt.")).toBeInTheDocument()
    await user.click(button('Try again'))
    expect(promptState.retry).toHaveBeenCalledTimes(1)
  })

  it('keeps the current prompt and says so when a new one fails to load', () => {
    setup({ promptState: readyPrompt({ status: 'error' }) })
    expect(screen.getByText(PROMPT.prompt)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load another prompt. Keeping the current one.")
  })

  it('New prompt calls onNewPrompt straight away when nothing would be lost', async () => {
    const { user, onNewPrompt } = setup()
    await user.click(button('New prompt'))
    expect(onNewPrompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Discard this recording\?/)).not.toBeInTheDocument()
  })

  it('New prompt is disabled while recording', () => {
    setup({ recorder: makeRecorder({ status: 'recording', seconds: 3 }) })
    expect(button('New prompt')).toBeDisabled()
  })

  it('asks before discarding a recording, and Discard calls onNewPrompt', async () => {
    const { user, onNewPrompt } = setup({ recorder: recorded(45) })
    await user.click(button('New prompt'))
    expect(onNewPrompt).not.toHaveBeenCalled()
    const confirm = screen.getByText(/Discard this recording\?/).closest('[role="alert"]')
    expect(confirm).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Discard' }))
    expect(onNewPrompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Discard this recording\?/)).not.toBeInTheDocument()
  })

  it('Cancel closes the confirm without discarding', async () => {
    const { user, onNewPrompt } = setup({ recorder: recorded(45) })
    await user.click(button('New prompt'))
    await user.click(button('Cancel'))
    expect(onNewPrompt).not.toHaveBeenCalled()
    expect(screen.queryByText(/Discard this recording\?/)).not.toBeInTheDocument()
  })

  it('does not bring the confirm back after Record again leaves nothing to discard', async () => {
    const props = {
      promptState: readyPrompt(),
      phase: 'idle',
      evaluateError: null,
      hasResult: false,
      onEvaluate: vi.fn(),
      onRecordAgain: vi.fn(),
      onNewPrompt: vi.fn(),
    }
    const { user, rerender } = setup({ recorder: recorded(45) })
    await user.click(button('New prompt'))
    expect(screen.getByText(/Discard this recording\?/)).toBeInTheDocument()

    rerender(<PracticePanel {...props} recorder={makeRecorder({ status: 'recording', seconds: 1 })} />)
    expect(screen.queryByText(/Discard this recording\?/)).not.toBeInTheDocument()
    rerender(<PracticePanel {...props} recorder={makeRecorder()} />)
    expect(screen.queryByText(/Discard this recording\?/)).not.toBeInTheDocument()
  })

  it('asks before discarding when only a result exists', async () => {
    const { user, onNewPrompt } = setup({ hasResult: true })
    await user.click(button('New prompt'))
    expect(onNewPrompt).not.toHaveBeenCalled()
    expect(screen.getByText(/Discard this recording\?/)).toBeInTheDocument()
  })
})

describe('PracticePanel recorder states', () => {
  it('idle: Start recording, timer and help line', async () => {
    const recorder = makeRecorder()
    const { user } = setup({ recorder })
    expect(screen.getByRole('timer')).toHaveTextContent('0:00 / 2:00')
    expect(screen.getByText('Press to start. Speak for 1-2 minutes.')).toBeInTheDocument()
    expect(screen.queryByTestId('player')).not.toBeInTheDocument()
    await user.click(button('Start recording'))
    expect(recorder.start).toHaveBeenCalledTimes(1)
  })

  it('idle mic is indigo, not red', () => {
    setup()
    expect(button('Start recording').className).toMatch(/indigo/)
    expect(button('Start recording').className).not.toMatch(/rose/)
  })

  it('recording: Stop recording, live dot, counting timer, live waveform', async () => {
    const recorder = makeRecorder({ status: 'recording', seconds: 75, level: 0.2 })
    const { user } = setup({ recorder })
    expect(screen.getByText('Recording')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('1:15 / 2:00')
    expect(screen.getByText('Stops by itself at 2:00.')).toBeInTheDocument()
    expect(button('Stop recording').className).toMatch(/rose/)
    expect(screen.queryByRole('button', { name: 'Start recording' })).not.toBeInTheDocument()
    await user.click(button('Stop recording'))
    expect(recorder.stop).toHaveBeenCalledTimes(1)
  })

  it('recorded: player, Record again and Evaluate; no mic button', async () => {
    const { user, onRecordAgain, onEvaluate } = setup({ recorder: recorded(45) })
    expect(screen.getByTestId('player')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /recording$/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Speak for at least 0:30')).not.toBeInTheDocument()
    await user.click(button('Record again'))
    expect(onRecordAgain).toHaveBeenCalledTimes(1)
    await user.click(button('Evaluate'))
    expect(onEvaluate).toHaveBeenCalledTimes(1)
  })

  it('29 s keeps Evaluate disabled with the hint, 30 s enables it', () => {
    const { rerender } = setup({ recorder: recorded(MIN_SECONDS - 1) })
    expect(button('Evaluate')).toBeDisabled()
    expect(screen.getByText('Speak for at least 0:30')).toBeInTheDocument()
    expect(button('Evaluate')).toHaveAccessibleDescription('Speak for at least 0:30')

    rerender(
      <PracticePanel
        promptState={readyPrompt()}
        recorder={recorded(MIN_SECONDS)}
        phase="idle"
        evaluateError={null}
        hasResult={false}
        onEvaluate={vi.fn()}
        onRecordAgain={vi.fn()}
        onNewPrompt={vi.fn()}
      />,
    )
    expect(button('Evaluate')).toBeEnabled()
    expect(screen.queryByText('Speak for at least 0:30')).not.toBeInTheDocument()
  })

  it('grading: Evaluate is busy and disabled, Record again and New prompt are locked, player stays', () => {
    setup({ recorder: recorded(45), phase: 'grading' })
    const evaluate = button('Evaluating...')
    expect(evaluate).toBeDisabled()
    expect(evaluate).toHaveAttribute('aria-busy', 'true')
    expect(button('Record again')).toBeDisabled()
    expect(button('New prompt')).toBeDisabled()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  it('graded: Evaluate is hidden, Record again stays', async () => {
    const { user, onRecordAgain } = setup({ recorder: recorded(45), phase: 'graded', hasResult: true })
    expect(screen.queryByRole('button', { name: 'Evaluate' })).not.toBeInTheDocument()
    await user.click(button('Record again'))
    expect(onRecordAgain).toHaveBeenCalledTimes(1)
  })

  it('shows an evaluate error inline with the player still there', () => {
    setup({ recorder: recorded(45), evaluateError: 'We could not hear any speech.' })
    expect(screen.getByRole('alert')).toHaveTextContent('We could not hear any speech.')
    expect(screen.getByTestId('player')).toBeInTheDocument()
    expect(button('Evaluate')).toBeEnabled()
  })

  it('mic blocked: shows the recorder error and Try again calls start', async () => {
    const recorder = makeRecorder({ status: 'error', error: 'Microphone access was blocked.' })
    const { user } = setup({ recorder })
    const alert = screen.getByText('Microphone access was blocked.').closest('[role="alert"]')
    expect(alert).toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(recorder.start).toHaveBeenCalledTimes(1)
  })

  it('notes when the recording stopped at the limit', () => {
    setup({ recorder: recorded(120, { limitReached: true }) })
    expect(screen.getByText('Recording stopped at 2:00.')).toBeInTheDocument()
  })

  it('shows no limit note by default', () => {
    setup({ recorder: recorded(45) })
    expect(screen.queryByText(/Recording stopped at/)).not.toBeInTheDocument()
  })
})
