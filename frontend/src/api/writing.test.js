import { api } from './client'
import { describeError, evaluateEssay, fetchPrompt, TASK_TYPES } from './writing'

afterEach(() => vi.restoreAllMocks())

const httpError = (status, body = {}, headers = {}) =>
  Object.assign(new Error('Request failed'), { response: { status, data: body, headers } })

test('maps each UI task to its API task type', () => {
  expect(TASK_TYPES).toEqual({ ielts: 'IELTS_TASK2', standup: 'TECH_STANDUP' })
})

test('fetchPrompt asks for a prompt of the given task type', async () => {
  const data = { id: 'task2-01', prompt: 'Some prompt', min_words: 250, max_words: null, suggested_minutes: 40 }
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data })

  expect(await fetchPrompt('ielts')).toEqual(data)
  expect(get).toHaveBeenCalledWith('/english/writing/prompts', { params: { task_type: 'IELTS_TASK2' } })
})

test('evaluateEssay posts the essay with a timeout long enough for the AI', async () => {
  const data = { overall_band: 7 }
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data })

  expect(await evaluateEssay({ task: 'standup', promptTopic: 'Topic', essay: 'My essay' })).toEqual(data)
  expect(post).toHaveBeenCalledWith(
    '/english/writing/evaluate',
    { task_type: 'TECH_STANDUP', prompt_topic: 'Topic', user_essay: 'My essay' },
    { timeout: 60000 },
  )
})

test('a network failure says the essay is kept', () => {
  const message = describeError(Object.assign(new Error('Network Error'), { request: {} }))
  expect(message).toMatch(/connect to the server/i)
  expect(message).toMatch(/essay is safe/i)
})

test('a rate limit tells the user how long to wait', () => {
  const message = describeError(httpError(429, { error: { code: 'RATE_LIMITED' } }, { 'retry-after': '30' }))
  expect(message).toMatch(/busy/i)
  expect(message).toContain('30 seconds')
})

test('a rate limit without Retry-After still gives a friendly message', () => {
  expect(describeError(httpError(429))).toMatch(/busy.*try again in a moment/i)
})

test('an unusable AI answer asks the user to retry', () => {
  expect(describeError(httpError(502, { error: { code: 'AI_INVALID_RESPONSE' } }))).toMatch(/try again/i)
})

test('a validation error shows the server message', () => {
  expect(describeError(httpError(422, { error: { code: 'VALIDATION_ERROR', message: 'Essay too short' } }))).toContain(
    'Essay too short',
  )
})

test('anything else falls back to a generic message', () => {
  expect(describeError(httpError(500))).toMatch(/something went wrong/i)
})
