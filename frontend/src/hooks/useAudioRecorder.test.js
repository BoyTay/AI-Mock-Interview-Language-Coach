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
  FakeRecorder.last = null
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

describe('timer and length limit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('counts the seconds while recording and keeps the length once stopped', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await record(result)

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.seconds).toBe(3)

    act(() => result.current.stop())
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.seconds).toBe(3)
  })

  test('stops by itself at the limit and says so', async () => {
    const { result } = renderHook(() => useAudioRecorder({ maxSeconds: 5 }))
    await record(result)

    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.status).toBe('recorded')
    expect(result.current.seconds).toBe(5)
    expect(result.current.limitReached).toBe(true)
    expect(result.current.blob).toBeInstanceOf(Blob)
  })

  test('allows 3 minutes by default', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await record(result)

    act(() => vi.advanceTimersByTime(179_000))
    expect(result.current.status).toBe('recording')

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.status).toBe('recorded')
  })

  test('a new recording starts from zero and clears the limit notice', async () => {
    const { result } = renderHook(() => useAudioRecorder({ maxSeconds: 2 }))
    await record(result)
    act(() => vi.advanceTimersByTime(2000))

    act(() => result.current.reset())
    expect(result.current).toMatchObject({ seconds: 0, limitReached: false })

    await record(result)
    expect(result.current.seconds).toBe(0)
    expect(result.current.limitReached).toBe(false)
  })
})

describe('releasing the microphone', () => {
  test('stopping a recording turns the microphone off', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await record(result)
    expect(tracks[0].stop).not.toHaveBeenCalled()

    act(() => result.current.stop())

    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
  })

  test('leaving the screen mid-recording stops the recorder, the microphone and the timer', async () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useAudioRecorder())
    await record(result)
    const recorder = FakeRecorder.last

    unmount()

    expect(recorder.state).toBe('inactive')
    expect(tracks[0].stop).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })

  test('a microphone granted after the screen was left is released at once', async () => {
    let grant
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)))
    const { result, unmount } = renderHook(() => useAudioRecorder())
    let pending
    act(() => {
      pending = result.current.start()
    })

    unmount()
    await act(async () => {
      grant({ getTracks: () => tracks })
      await pending
    })

    expect(tracks[0].stop).toHaveBeenCalled()
    expect(FakeRecorder.last?.state).not.toBe('recording')
  })

  test('resetting mid-recording discards it and turns the microphone off', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await record(result)

    act(() => result.current.reset())

    expect(tracks[0].stop).toHaveBeenCalled()
    expect(result.current).toMatchObject({ status: 'idle', blob: null })
  })
})
