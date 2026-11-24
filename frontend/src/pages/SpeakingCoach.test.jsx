import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { evaluateSpeech, fetchSpeakingPrompt } from '@/api/speaking'
import SpeakingCoach from './SpeakingCoach'

vi.mock('@/components/interview/AudioPlayer', () => ({
  default: ({ blob, label }) => <div data-testid="player" data-label={label} data-size={blob?.size} />,
}))

vi.mock('@/api/speaking', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchSpeakingPrompt: vi.fn(),
  evaluateSpeech: vi.fn(),
}))

// A controllable stand-in for the recorder: a module-level store the mocked hook subscribes to.
const fake = vi.hoisted(() => {
  const idle = {
    status: 'idle',
    error: null,
    blob: null,
    mimeType: '',
    seconds: 0,
    limitReached: false,
    level: 0,
  }
  const store = { state: idle, listeners: new Set(), idle }
  store.set = (next) => {
    store.state = { ...store.state, ...next }
    store.listeners.forEach((l) => l())
  }
  store.start = vi.fn()
  store.stop = vi.fn()
  store.reset = vi.fn()
  return store
})

vi.mock('@/hooks/useAudioRecorder', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useAudioRecorder: () => {
      const [, force] = useState(0)
      useEffect(() => {
        const l = () => force((n) => n + 1)
        fake.listeners.add(l)
        return () => fake.listeners.delete(l)
      }, [])
      return { ...fake.state, start: fake.start, stop: fake.stop, reset: fake.reset }
    },
  }
})

const PROMPT = { id: 'p1', prompt: 'Give your daily standup update.', min_seconds: 60, max_seconds: 120 }
const PROMPT_2 = { id: 'p2', prompt: 'Describe a bug you fixed this week.', min_seconds: 60, max_seconds: 120 }

const RESULT = {
  id: 's1',
  prompt_text: PROMPT.prompt,
  transcript: 'Yesterday I fixed the issue.',
  duration_seconds: 84,
  words_per_minute: 129,
  overall_band: 6.5,
  band_delta: null,
  summary: 'Clear update and a steady pace.',
  criteria: {
    fluency: { score: 7.0, feedback: 'Steady pace.' },
    pronunciation: { score: 6.0, feedback: 'Word stress slips.' },
    vocabulary: { score: 6.5, feedback: 'Clear technical words.' },
    grammar: { score: 5.5, feedback: 'Agreement slips.' },
  },
  marks: [],
  grammar_corrections: [],
  vocabulary_upgrades: [],
  filler_count: 0,
  created_at: '2026-11-24T10:00:00Z',
}
const RESULT_2 = { ...RESULT, id: 's2', overall_band: 7.5, summary: 'Even better this time.' }

const recordAs = (seconds = 84) =>
  fake.set({ status: 'recorded', blob: new Blob(['voice']), mimeType: 'audio/webm', seconds })

function setup() {
  const view = render(
    <MemoryRouter>
      <SpeakingCoach />
    </MemoryRouter>,
  )
  return { ...view, user: userEvent.setup() }
}

const button = (name) => screen.getByRole('button', { name })

beforeEach(() => {
  fake.state = fake.idle
  fake.start.mockReset()
  fake.stop.mockReset()
  fake.reset.mockReset()
  fake.start.mockImplementation(async () => fake.set({ status: 'recording', seconds: 0 }))
  fake.reset.mockImplementation(() => fake.set({ ...fake.idle }))
  fetchSpeakingPrompt.mockReset()
  fetchSpeakingPrompt.mockResolvedValueOnce(PROMPT)
  evaluateSpeech.mockReset()
})

describe('SpeakingCoach', () => {
  it('loads and shows the prompt next to the empty grading panel', async () => {
    setup()
    expect(await screen.findByText(PROMPT.prompt)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'English Speaking Coach' })).toBeInTheDocument()
    expect(screen.getByText('Your feedback will appear here')).toBeInTheDocument()
  })

  it('goes from a recording to a graded result and sends the duration and prompt', async () => {
    evaluateSpeech.mockResolvedValue(RESULT)
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs(84))
    await user.click(button('Evaluate'))

    expect(await screen.findByLabelText('Overall band 6.5')).toBeInTheDocument()
    expect(evaluateSpeech).toHaveBeenCalledTimes(1)
    expect(evaluateSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 84, promptText: PROMPT.prompt, mimeType: 'audio/webm' }),
    )
    expect(evaluateSpeech.mock.calls[0][0].blob).toBeInstanceOf(Blob)
    expect(screen.queryByText('Previous result')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Evaluate' })).not.toBeInTheDocument()
  })

  it('shows the grading skeleton while the request is out', async () => {
    let resolve
    evaluateSpeech.mockReturnValue(new Promise((r) => (resolve = r)))
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))
    expect(screen.getByLabelText('Grading your recording')).toHaveAttribute('aria-busy', 'true')
    await act(async () => resolve(RESULT))
    expect(await screen.findByLabelText('Overall band 6.5')).toBeInTheDocument()
  })

  it('sends one request when Evaluate is double clicked', async () => {
    let resolve
    evaluateSpeech.mockReturnValue(new Promise((r) => (resolve = r)))
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.dblClick(button('Evaluate'))
    expect(evaluateSpeech).toHaveBeenCalledTimes(1)
    await act(async () => resolve(RESULT))
    await screen.findByLabelText('Overall band 6.5')
    expect(evaluateSpeech).toHaveBeenCalledTimes(1)
  })

  it('ignores a second Evaluate that arrives before the button re-renders as disabled', async () => {
    let resolve
    evaluateSpeech.mockReturnValue(new Promise((r) => (resolve = r)))
    setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    const evaluate = button('Evaluate')
    // Two click events dispatched in the same tick, before React commits the disabled state.
    act(() => {
      evaluate.click()
      evaluate.click()
    })
    expect(evaluateSpeech).toHaveBeenCalledTimes(1)
    await act(async () => resolve(RESULT))
  })

  it('keeps the recording and explains when no speech was heard', async () => {
    evaluateSpeech.mockRejectedValue({ response: { status: 422, data: { error: { code: 'NO_SPEECH_DETECTED' } } } })
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))

    expect(
      await screen.findByText('We could not hear any speech. Record again closer to the microphone.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
    expect(button('Evaluate')).toBeEnabled()
    expect(screen.getByText('Your feedback will appear here')).toBeInTheDocument()
  })

  it('shows the wait time for a rate limit and keeps the recording', async () => {
    evaluateSpeech.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '42' }, data: {} } })
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))

    expect(
      await screen.findByText('Too many requests. Try again in 42 seconds. Your recording is kept.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  it('allows evaluating again after a failure', async () => {
    evaluateSpeech.mockRejectedValueOnce({ response: { status: 503, data: {} } }).mockResolvedValueOnce(RESULT)
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))
    await screen.findByText(/temporarily unavailable/)
    await user.click(button('Evaluate'))
    expect(await screen.findByLabelText('Overall band 6.5')).toBeInTheDocument()
    expect(evaluateSpeech).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/temporarily unavailable/)).not.toBeInTheDocument()
  })

  it('labels the result Previous while re-recording, then replaces it on the next Evaluate', async () => {
    evaluateSpeech.mockResolvedValueOnce(RESULT).mockResolvedValueOnce(RESULT_2)
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))
    await screen.findByLabelText('Overall band 6.5')

    await user.click(button('Record again'))
    expect(fake.reset).toHaveBeenCalledTimes(1)
    expect(fake.start).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Previous result')).toBeInTheDocument()
    expect(screen.getByLabelText('Overall band 6.5')).toBeInTheDocument()

    act(() => recordAs(70))
    await user.click(button('Evaluate'))
    expect(await screen.findByLabelText('Overall band 7.5')).toBeInTheDocument()
    expect(screen.queryByText('Previous result')).not.toBeInTheDocument()
    expect(evaluateSpeech).toHaveBeenLastCalledWith(expect.objectContaining({ durationSeconds: 70 }))
  })

  it('shows the skeleton instead of the previous result while grading again', async () => {
    let resolve
    evaluateSpeech.mockResolvedValueOnce(RESULT).mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))
    await screen.findByLabelText('Overall band 6.5')
    await user.click(button('Record again'))
    act(() => recordAs(70))
    await user.click(button('Evaluate'))

    expect(screen.getByLabelText('Grading your recording')).toBeInTheDocument()
    expect(screen.queryByLabelText('Overall band 6.5')).not.toBeInTheDocument()
    await act(async () => resolve(RESULT_2))
    expect(await screen.findByLabelText('Overall band 7.5')).toBeInTheDocument()
  })

  it('keeps the previous result when the new Evaluate fails', async () => {
    evaluateSpeech.mockResolvedValueOnce(RESULT).mockRejectedValueOnce({ response: { status: 503, data: {} } })
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))
    await screen.findByLabelText('Overall band 6.5')
    await user.click(button('Record again'))
    act(() => recordAs(70))
    await user.click(button('Evaluate'))

    await screen.findByText(/temporarily unavailable/)
    expect(screen.getByLabelText('Overall band 6.5')).toBeInTheDocument()
    expect(screen.getByText('Previous result')).toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  it('clears the result and fetches another prompt after New prompt and Discard', async () => {
    fetchSpeakingPrompt.mockResolvedValueOnce(PROMPT_2)
    evaluateSpeech.mockResolvedValue(RESULT)
    const { user } = setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs())
    await user.click(button('Evaluate'))
    await screen.findByLabelText('Overall band 6.5')

    await user.click(button('New prompt'))
    await user.click(button('Discard'))

    expect(await screen.findByText(PROMPT_2.prompt)).toBeInTheDocument()
    expect(fake.reset).toHaveBeenCalled()
    expect(fetchSpeakingPrompt).toHaveBeenCalledTimes(2)
    expect(screen.queryByLabelText('Overall band 6.5')).not.toBeInTheDocument()
    expect(screen.getByText('Your feedback will appear here')).toBeInTheDocument()
  })

  it('does not call Evaluate for a recording that is too short', async () => {
    setup()
    await screen.findByText(PROMPT.prompt)
    act(() => recordAs(10))
    expect(button('Evaluate')).toBeDisabled()
    await waitFor(() => expect(evaluateSpeech).not.toHaveBeenCalled())
  })
})
