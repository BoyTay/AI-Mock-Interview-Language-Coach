import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fetchAnswerAudio } from '@/api/interview'
import { decodePeaks } from '@/utils/waveform'
import AudioPlayer from './AudioPlayer'

vi.mock('@/api/interview', () => ({ fetchAnswerAudio: vi.fn() }))
vi.mock('@/utils/waveform', async (importOriginal) => ({ ...(await importOriginal()), decodePeaks: vi.fn() }))

const BLOB = new Blob(['voice'], { type: 'audio/webm' })
const PEAKS = Array.from({ length: 48 }, (_, i) => (i % 4) / 4)

let urls
beforeAll(() => {
  // jsdom has no PointerEvent; a MouseEvent carries clientX the same way.
  window.PointerEvent ??= class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
})
beforeEach(() => {
  urls = 0
  URL.createObjectURL = vi.fn(() => `blob:recording-${++urls}`)
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function play() {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {
    this.dispatchEvent(new Event('pause'))
  })
  fetchAnswerAudio.mockResolvedValue(BLOB)
  decodePeaks.mockResolvedValue({ duration: 65, peaks: PEAKS })
})
afterEach(() => {
  cleanup() // unmount (which pauses) while play/pause are still stubbed
  vi.restoreAllMocks()
  fetchAnswerAudio.mockReset()
  decodePeaks.mockReset()
})

async function renderLoaded(props = {}) {
  const utils = render(<AudioPlayer sessionId={7} messageId={42} {...props} />)
  await screen.findByText('00:00 / 01:05')
  return { ...utils, audio: utils.container.querySelector('audio') }
}

test('fetches the recording for its session and message and enables Play', async () => {
  render(<AudioPlayer sessionId={7} messageId={42} />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading recording…')

  expect(await screen.findByRole('button', { name: 'Play recording' })).toBeEnabled()
  expect(fetchAnswerAudio).toHaveBeenCalledWith(7, 42, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  expect(decodePeaks).toHaveBeenCalledWith(BLOB, 48)
})

test('shows the decoded duration even when the element reports Infinity', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(Infinity)
  const { audio } = await renderLoaded()

  fireEvent(audio, new Event('durationchange'))

  expect(screen.getByText('00:00 / 01:05')).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Recording position' })).toHaveAttribute('aria-valuemax', '65')
})

test('play toggles to pause and back', async () => {
  const user = userEvent.setup()
  await renderLoaded()

  await user.click(screen.getByRole('button', { name: 'Play recording' }))
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: 'Pause recording' }))
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument()
})

test('arrow keys seek five seconds and Home/End jump', async () => {
  const user = userEvent.setup()
  const { audio } = await renderLoaded()
  const slider = screen.getByRole('slider', { name: 'Recording position' })
  slider.focus()

  await user.keyboard('{ArrowRight}')
  expect(audio.currentTime).toBe(5)
  expect(slider).toHaveAttribute('aria-valuetext', '00:05 of 01:05')
  await user.keyboard('{End}')
  expect(audio.currentTime).toBe(65)
  await user.keyboard('{ArrowRight}')
  expect(audio.currentTime).toBe(65)
  await user.keyboard('{Home}')
  expect(audio.currentTime).toBe(0)
  await user.keyboard('{ArrowLeft}')
  expect(audio.currentTime).toBe(0)
})

test('the speed button cycles 1x, 1.25x, 1.5x and sets the playback rate', async () => {
  const user = userEvent.setup()
  const { audio } = await renderLoaded()

  await user.click(screen.getByRole('button', { name: 'Playback speed 1x' }))
  expect(audio.playbackRate).toBe(1.25)
  await user.click(screen.getByRole('button', { name: 'Playback speed 1.25x' }))
  expect(audio.playbackRate).toBe(1.5)
  await user.click(screen.getByRole('button', { name: 'Playback speed 1.5x' }))
  expect(audio.playbackRate).toBe(1)
  expect(screen.getByRole('button', { name: 'Playback speed 1x' })).toHaveTextContent('1x')
})

test('clicking the waveform seeks to that point', async () => {
  const { audio } = await renderLoaded()
  const slider = screen.getByRole('slider', { name: 'Recording position' })
  slider.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 32, right: 200, bottom: 32 })

  fireEvent.pointerDown(slider, { clientX: 50, button: 0 })

  expect(audio.currentTime).toBe(16.25)
  expect(screen.getByText('00:16 / 01:05')).toBeInTheDocument()
})

test('ending playback shows Play again', async () => {
  const user = userEvent.setup()
  const { audio } = await renderLoaded()
  await user.click(screen.getByRole('button', { name: 'Play recording' }))

  fireEvent(audio, new Event('ended'))

  expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument()
})

test('starting a second player pauses the first', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <>
      <AudioPlayer sessionId={7} messageId={42} label="First" />
      <AudioPlayer sessionId={7} messageId={43} label="Second" />
    </>,
  )
  const [play1, play2] = await screen.findAllByRole('button', { name: 'Play recording' })
  await screen.findAllByText('00:00 / 01:05')
  const [first] = container.querySelectorAll('audio')

  await user.click(play1)
  await user.click(play2)

  expect(HTMLMediaElement.prototype.pause.mock.contexts).toContain(first)
  expect(screen.getAllByRole('button', { name: 'Play recording' })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Pause recording' })).toBeInTheDocument()
})

test('unmounting pauses and frees the recording', async () => {
  const { audio, unmount } = await renderLoaded()

  unmount()

  expect(HTMLMediaElement.prototype.pause.mock.contexts).toContain(audio)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording-1')
})

function expiredError(body) {
  return { response: { status: 410, data: new Blob([body]) } }
}

test('shows the expiry message without Try again', async () => {
  const message = 'This recording was deleted after 90 days.'
  fetchAnswerAudio.mockRejectedValueOnce(expiredError(JSON.stringify({ error: { code: 'AUDIO_EXPIRED', message } })))
  render(<AudioPlayer sessionId={7} messageId={42} />)

  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play recording' })).toBeDisabled()
})

test('falls back to a generic expiry message when the body is not readable', async () => {
  fetchAnswerAudio.mockRejectedValueOnce(expiredError('not json'))
  render(<AudioPlayer sessionId={7} messageId={42} />)

  expect(await screen.findByText('This recording has been deleted.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

test('a failed download says the recording is unavailable and can be retried', async () => {
  const user = userEvent.setup()
  fetchAnswerAudio.mockRejectedValueOnce(new Error('404'))
  render(<AudioPlayer sessionId={7} messageId={42} />)

  expect(await screen.findByText(/Recording unavailable/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play recording' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('00:00 / 01:05')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play recording' })).toBeEnabled()
  expect(fetchAnswerAudio).toHaveBeenCalledTimes(2)
})

test('a recording that cannot be decoded is still playable', async () => {
  decodePeaks.mockRejectedValue(new Error('cannot decode'))
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(12)
  const { container } = render(<AudioPlayer sessionId={7} messageId={42} />)
  const play = await screen.findByRole('button', { name: 'Play recording' })
  await act(async () => {})
  fireEvent(container.querySelector('audio'), new Event('durationchange'))

  expect(play).toBeEnabled()
  expect(screen.getByText('00:00 / 00:12')).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Recording position' })).not.toHaveAttribute('aria-disabled', 'true')
})

test('without a known duration the slider is disabled and shows dashes', async () => {
  decodePeaks.mockRejectedValue(new Error('cannot decode'))
  render(<AudioPlayer sessionId={7} messageId={42} />)
  await screen.findByRole('button', { name: 'Play recording' })
  await act(async () => {})

  expect(screen.getByText('00:00 / --:--')).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Recording position' })).toHaveAttribute('aria-disabled', 'true')
})

test('a recording the browser cannot play says so instead of a dead Play button', async () => {
  const { audio } = await renderLoaded()

  fireEvent(audio, new Event('error'))

  expect(screen.getByText("This recording can't be played in this browser.")).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Play recording' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

test('plays a local blob without fetching', async () => {
  const { unmount } = render(<AudioPlayer blob={BLOB} label="Your recording" />)

  expect(await screen.findByRole('button', { name: 'Play recording' })).toBeEnabled()
  expect(await screen.findByText('00:00 / 01:05')).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Your recording position' })).toBeInTheDocument()
  expect(fetchAnswerAudio).not.toHaveBeenCalled()
  expect(URL.createObjectURL).toHaveBeenCalledWith(BLOB)
  expect(decodePeaks).toHaveBeenCalledWith(BLOB, 48)

  unmount()

  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording-1')
})

test('a new blob replaces the old one and frees its URL', async () => {
  const next = new Blob(['again'], { type: 'audio/webm' })
  const { rerender } = render(<AudioPlayer blob={BLOB} />)
  await screen.findByText('00:00 / 01:05')

  rerender(<AudioPlayer blob={next} />)
  await screen.findByText('00:00 / 01:05')

  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording-1')
  expect(URL.createObjectURL).toHaveBeenLastCalledWith(next)
  expect(fetchAnswerAudio).not.toHaveBeenCalled()
})
