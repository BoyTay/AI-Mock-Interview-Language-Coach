import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnswerDock from './AnswerDock'

let tracks
let getUserMedia

class FakeRecorder {
  static isTypeSupported = () => true

  constructor(stream, options = {}) {
    this.mimeType = options.mimeType ?? ''
    this.state = 'inactive'
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

beforeEach(() => {
  tracks = [{ stop: vi.fn() }]
  getUserMedia = vi.fn(async () => ({ getTracks: () => tracks }))
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
})

afterEach(() => {
  delete navigator.mediaDevices
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const tab = (name) => screen.getByRole('button', { name })
const send = () => screen.getByRole('button', { name: 'Send answer' })

function setup(props = {}) {
  const user = userEvent.setup()
  render(<AnswerDock onSend={vi.fn()} {...props} />)
  return user
}

test('opens on Text & Code and offers Voice as the other answer mode', () => {
  setup()

  expect(tab('Text & Code')).toHaveAttribute('aria-pressed', 'true')
  expect(tab('Voice')).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByLabelText('Type your answer')).toBeInTheDocument()
})

test('the Voice tab shows a ready microphone and a Send answer that is locked, with the reason', async () => {
  const user = setup()

  await user.click(tab('Voice'))

  expect(tab('Voice')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByLabelText('Type your answer')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled()
  expect(screen.getByRole('timer', { name: 'Recording duration' })).toHaveTextContent('00:00')
  expect(send()).toBeDisabled()
  expect(send()).toHaveAccessibleDescription(/isn't available yet/i)
  expect(screen.getByRole('button', { name: 'Re-record' })).toBeDisabled()
})

test('tapping the microphone records, and tapping it again stops', async () => {
  const user = setup()
  await user.click(tab('Voice'))

  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeEnabled()
  expect(screen.getByText('Recording')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Stop recording' }))
  expect(screen.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument()
  expect(screen.getByText('Recorded')).toBeInTheDocument()
  expect(send()).toBeDisabled()
  expect(tracks[0].stop).toHaveBeenCalled()
})

test('Send answer hands the recording to onSendAudio once the page can send it', async () => {
  const onSendAudio = vi.fn()
  const user = setup({ onSendAudio })
  await user.click(tab('Voice'))
  expect(send()).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
  expect(send()).toBeEnabled()
  await user.click(send())

  expect(onSendAudio).toHaveBeenCalledTimes(1)
  const [blob, mimeType] = onSendAudio.mock.calls[0]
  expect(blob).toBeInstanceOf(Blob)
  expect(mimeType).toBe('audio/webm;codecs=opus')
})

test('Re-record throws the take away and starts a new one', async () => {
  const user = setup()
  await user.click(tab('Voice'))
  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  await user.click(await screen.findByRole('button', { name: 'Stop recording' }))

  await user.click(screen.getByRole('button', { name: 'Re-record' }))

  expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
  expect(getUserMedia).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('timer', { name: 'Recording duration' })).toHaveTextContent('00:00')
})

test('explains a blocked microphone and lets the candidate try again', async () => {
  getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
  const user = setup()
  await user.click(tab('Voice'))

  await user.click(screen.getByRole('button', { name: 'Start recording' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/microphone access was blocked/i)
  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('switching back to Text & Code mid-recording turns the microphone off and keeps the typed draft', async () => {
  const user = setup()
  await user.type(screen.getByLabelText('Type your answer'), 'My draft')
  await user.click(tab('Voice'))
  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  await screen.findByRole('button', { name: 'Stop recording' })

  await user.click(tab('Text & Code'))

  expect(tracks[0].stop).toHaveBeenCalled()
  expect(screen.getByLabelText('Type your answer')).toHaveValue('My draft')
})

test('tells the candidate when the 3-minute limit ended the recording', async () => {
  vi.useFakeTimers()
  setup()
  fireEvent.click(tab('Voice'))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  })

  act(() => vi.advanceTimersByTime(180_000))

  expect(screen.getByText(/3-minute limit/i)).toBeInTheDocument()
  expect(screen.getByRole('timer', { name: 'Recording duration' })).toHaveTextContent('03:00')
})

test('locks the answer mode while an answer is being sent', () => {
  setup({ sending: true })

  expect(tab('Voice')).toBeDisabled()
  expect(tab('Text & Code')).toBeDisabled()
})

test('starting or restarting a recording tells the room first', async () => {
  const onRecordStart = vi.fn()
  const user = setup({ onRecordStart })
  await user.click(tab('Voice'))

  await user.click(screen.getByRole('button', { name: 'Start recording' }))
  expect(onRecordStart).toHaveBeenCalledTimes(1)
  expect(onRecordStart.mock.invocationCallOrder[0]).toBeLessThan(getUserMedia.mock.invocationCallOrder[0])

  await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
  await user.click(screen.getByRole('button', { name: 'Re-record' }))
  expect(onRecordStart).toHaveBeenCalledTimes(2)
})
