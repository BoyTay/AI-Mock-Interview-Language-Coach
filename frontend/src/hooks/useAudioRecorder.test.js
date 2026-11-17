import { act, renderHook } from '@testing-library/react'
import { useAudioRecorder } from './useAudioRecorder'

const WEBM = 'audio/webm;codecs=opus'
const MP4 = 'audio/mp4'

let supported
let tracks
let getUserMedia

class FakeRecorder {
  static isTypeSupported = (type) => supported.includes(type)

  constructor(stream, options = {}) {
    this.stream = stream
    this.mimeType = options.mimeType ?? ''
    this.state = 'inactive'
    FakeRecorder.last = this
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

function domError(name) {
  const error = new Error(name)
  error.name = name
  return error
}

beforeEach(() => {
  supported = [WEBM, MP4]
  tracks = [{ stop: vi.fn() }]
  getUserMedia = vi.fn(async () => ({ getTracks: () => tracks }))
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
})

afterEach(() => {
  delete navigator.mediaDevices
  vi.unstubAllGlobals()
})

async function record(result) {
  await act(async () => {
    await result.current.start()
  })
}

test('starts idle with nothing recorded', () => {
  const { result } = renderHook(() => useAudioRecorder())
  expect(result.current).toMatchObject({ status: 'idle', error: '', blob: null, mimeType: '' })
})

test('asks for the microphone and records until stopped', async () => {
  const { result } = renderHook(() => useAudioRecorder())

  await record(result)
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  expect(result.current.status).toBe('recording')

  act(() => result.current.stop())
  expect(result.current.status).toBe('recorded')
  expect(result.current.mimeType).toBe(WEBM)
  expect(result.current.blob).toBeInstanceOf(Blob)
  expect(result.current.blob.size).toBeGreaterThan(0)
})

test('falls back to mp4 when the browser cannot record webm', async () => {
  supported = [MP4]
  const { result } = renderHook(() => useAudioRecorder())

  await record(result)
  act(() => result.current.stop())

  expect(result.current.mimeType).toBe(MP4)
})

test("uses the browser's own format when neither webm nor mp4 is supported", async () => {
  supported = []
  const { result } = renderHook(() => useAudioRecorder())

  await record(result)
  FakeRecorder.last.mimeType = 'audio/ogg'
  act(() => result.current.stop())

  expect(result.current.mimeType).toBe('audio/ogg')
})

test.each([
  ['NotAllowedError', /blocked/i],
  ['NotFoundError', /no microphone/i],
  ['NotReadableError', /another app/i],
  ['SomethingElse', /could not start/i],
])('explains a %s from getUserMedia and stays usable', async (name, message) => {
  getUserMedia.mockRejectedValueOnce(domError(name))
  const { result } = renderHook(() => useAudioRecorder())

  await record(result)

  expect(result.current.status).toBe('error')
  expect(result.current.error).toMatch(message)
  expect(result.current.blob).toBeNull()

  await record(result)
  expect(result.current.status).toBe('recording')
  expect(result.current.error).toBe('')
})

test('explains a browser that cannot record at all', async () => {
  vi.stubGlobal('MediaRecorder', undefined)
  const { result } = renderHook(() => useAudioRecorder())

  await record(result)

  expect(result.current.status).toBe('error')
  expect(result.current.error).toMatch(/can't record audio/i)
  expect(getUserMedia).not.toHaveBeenCalled()
})

test('reset drops the recording so the candidate can record again', async () => {
  const { result } = renderHook(() => useAudioRecorder())
  await record(result)
  act(() => result.current.stop())

  act(() => result.current.reset())
  expect(result.current).toMatchObject({ status: 'idle', blob: null, mimeType: '', error: '' })

  await record(result)
  act(() => result.current.stop())
  expect(result.current.blob).toBeInstanceOf(Blob)
})
