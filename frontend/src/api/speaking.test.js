import { api } from './client'
import { describeSpeakingError, evaluateSpeech, fetchSpeakingPrompt } from './speaking'

afterEach(() => vi.restoreAllMocks())

const httpError = (status, body = {}, headers = {}) =>
  Object.assign(new Error('Request failed'), { response: { status, data: body, headers } })

test('fetchSpeakingPrompt asks for a speaking prompt', async () => {
  const data = { id: 'sp-01', prompt: 'Describe your day', min_seconds: 30, max_seconds: 120 }
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data })

  expect(await fetchSpeakingPrompt()).toEqual(data)
  expect(get).toHaveBeenCalledWith('/english/speaking/prompts')
})

describe('evaluateSpeech', () => {
  const send = async (mimeType) => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { overall_band: 6.5 } })
    const blob = new Blob(['audio'], { type: mimeType })
    const result = await evaluateSpeech({ blob, mimeType, promptText: 'Describe your day', durationSeconds: 42 })
    const [url, form, config] = post.mock.calls[0]
    return { result, url, form, config }
  }

  test('posts the recording and its details with a timeout long enough for the AI', async () => {
    const { result, url, form, config } = await send('audio/webm;codecs=opus')

    expect(result).toEqual({ overall_band: 6.5 })
    expect(url).toBe('/english/speaking/evaluate')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('audio')).toBeInstanceOf(File)
    expect(form.get('audio').name).toBe('recording.webm')
    expect(form.get('prompt_text')).toBe('Describe your day')
    expect(form.get('duration_seconds')).toBe('42')
    expect(config).toEqual({ timeout: 120000 })
  })

  test.each([
    ['audio/mp4', 'recording.mp4'],
    ['audio/ogg;codecs=opus', 'recording.ogg'],
    ['audio/wav', 'recording.wav'],
    ['audio/x-unknown', 'recording.webm'],
    ['', 'recording.webm'],
  ])('%s is named %s', async (mimeType, name) => {
    const { form } = await send(mimeType)
    expect(form.get('audio').name).toBe(name)
  })
})

describe('describeSpeakingError', () => {
  test.each([
    [
      'no response',
      Object.assign(new Error('Network Error'), { request: {} }),
      "Can't connect to the server. Check your connection and try again. Your recording is kept.",
    ],
    [
      'timeout',
      Object.assign(new Error('timeout of 120000ms exceeded'), { code: 'ECONNABORTED', request: {} }),
      'Grading took too long. Your recording is kept. Try again.',
    ],
    [
      'no speech',
      httpError(422, { error: { code: 'NO_SPEECH_DETECTED' } }),
      'We could not hear any speech. Record again closer to the microphone.',
    ],
    [
      'unreadable audio',
      httpError(422, { error: { code: 'AUDIO_UNREADABLE' } }),
      'We could not read this recording. Try again, or record again.',
    ],
    [
      'recording too short',
      httpError(422, { error: { code: 'AUDIO_TOO_SHORT', message: 'This recording is shorter than 30 seconds. Please record a longer answer.' } }),
      'This recording is shorter than 30 seconds. Please record a longer answer. Your recording is kept.',
    ],
    [
      'recording too long',
      httpError(422, { error: { code: 'AUDIO_TOO_LONG', message: 'This recording is longer than the limit of 2:00. Please record a shorter answer.' } }),
      'This recording is longer than the limit of 2:00. Please record a shorter answer. Your recording is kept.',
    ],
    [
      'recording too short without a server message',
      httpError(422, { error: { code: 'AUDIO_TOO_SHORT' } }),
      'This recording is too short. Please record a longer answer. Your recording is kept.',
    ],
    [
      'recording too long without a server message',
      httpError(422, { error: { code: 'AUDIO_TOO_LONG' } }),
      'This recording is too long. Please record a shorter answer. Your recording is kept.',
    ],
    [
      'probe unavailable',
      httpError(503, { error: { code: 'AUDIO_PROBE_UNAVAILABLE', message: 'x' } }),
      'The server cannot check recordings right now. Please try again later. Your recording is kept.',
    ],
    [
      'rate limit with Retry-After',
      httpError(429, {}, { 'retry-after': '42' }),
      'Too many requests. Try again in 42 seconds. Your recording is kept.',
    ],
    ['rate limit without header', httpError(429), 'Too many requests. Try again in a moment. Your recording is kept.'],
    ['too large', httpError(413), 'This recording is too large to send. Record a shorter answer.'],
    [
      'unsupported type',
      httpError(415),
      "This recording's format is not supported. Try a recent Chrome, Edge, Firefox or Safari.",
    ],
    ['unreadable AI answer', httpError(502), 'The AI returned an answer we could not read. Please try again.'],
    [
      'AI unavailable',
      httpError(503),
      'The AI service is temporarily unavailable. Please try again in a moment. Your recording is kept.',
    ],
    ['anything else', httpError(500), 'Something went wrong while grading. Please try again.'],
    ['other 422', httpError(422, { error: { code: 'VALIDATION_ERROR' } }), 'Something went wrong while grading. Please try again.'],
  ])('%s', (_name, error, message) => expect(describeSpeakingError(error)).toBe(message))
})
