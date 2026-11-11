import { api } from './client'
import {
  describeInterviewError,
  fetchProfile,
  fetchReport,
  finishInterview,
  startInterview,
  submitAnswer,
} from './interview'

afterEach(() => vi.restoreAllMocks())

const httpError = (status, body = {}, headers = {}) =>
  Object.assign(new Error('Request failed'), { response: { status, data: body, headers } })
const apiError = (code, message = 'x') => ({ error: { code, message } })

test('fetchProfile reads the saved profile', async () => {
  const data = { target_role: 'Java Backend Developer', has_cv: true }
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data })

  expect(await fetchProfile()).toEqual(data)
  expect(get).toHaveBeenCalledWith('/profile')
})

test('startInterview posts the settings in API names with a long timeout', async () => {
  const data = { session_id: 7 }
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data })

  const result = await startInterview({
    targetRole: 'Java Dev',
    jobDescription: 'Spring Boot',
    questionCount: 8,
    difficulties: ['MID'],
  })

  expect(result).toEqual(data)
  expect(post).toHaveBeenCalledWith(
    '/interviews/start',
    { target_role: 'Java Dev', job_description: 'Spring Boot', question_count: 8, difficulties: ['MID'] },
    { timeout: 60000 },
  )
})

test('startInterview leaves out an empty job description and difficulty', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

  await startInterview({ targetRole: 'Dev', jobDescription: '   ', questionCount: 6, difficulties: null })

  expect(post.mock.calls[0][1]).toEqual({ target_role: 'Dev', question_count: 6 })
})

test('startInterview can pass a cancel signal', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  const controller = new AbortController()

  await startInterview({ targetRole: 'Dev', questionCount: 6 }, { signal: controller.signal })

  expect(post.mock.calls[0][2]).toEqual({ timeout: 60000, signal: controller.signal })
})

test('submitAnswer posts the answer to its session', async () => {
  const data = { session_complete: false }
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data })

  expect(await submitAnswer(7, 'My answer')).toEqual(data)
  expect(post).toHaveBeenCalledWith('/interviews/7/answer', { answer: 'My answer' }, { timeout: 90000 })
})

test('finishInterview and fetchReport use the session endpoints', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { overall_score: 70 } })
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { overall_score: 70 } })

  await finishInterview(7)
  await fetchReport(7)

  expect(post).toHaveBeenCalledWith('/interviews/7/finish', null, { timeout: 90000 })
  expect(get).toHaveBeenCalledWith('/interviews/7/report')
})

test('a network failure says the progress is kept', () => {
  const message = describeInterviewError(Object.assign(new Error('Network Error'), { request: {} }))

  expect(message).toMatch(/connect to the server/i)
  expect(message).toMatch(/answer is safe/i)
})

test('a rate limit tells the user how long to wait', () => {
  const message = describeInterviewError(httpError(429, apiError('RATE_LIMITED'), { 'retry-after': '30' }))

  expect(message).toMatch(/busy/i)
  expect(message).toContain('30 seconds')
})

test('a rate limit without Retry-After still gives a friendly message', () => {
  expect(describeInterviewError(httpError(429))).toMatch(/busy.*try again in a moment/i)
})

test('an unavailable AI service and an unreadable reply have their own messages', () => {
  expect(describeInterviewError(httpError(503, apiError('AI_UNAVAILABLE')))).toMatch(/temporarily unavailable/i)
  expect(describeInterviewError(httpError(502, apiError('AI_INVALID_RESPONSE')))).toMatch(/could not read/i)
})

test('an empty question bank tells the user to seed it', () => {
  expect(describeInterviewError(httpError(409, apiError('QUESTION_BANK_EMPTY')))).toMatch(/no interview questions/i)
})

test('finishing with no answers explains what to do', () => {
  expect(describeInterviewError(httpError(409, apiError('NO_ANSWERS')))).toMatch(/answer at least one question/i)
})

test('a session that no longer exists says so', () => {
  expect(describeInterviewError(httpError(404, apiError('SESSION_NOT_FOUND')))).toMatch(/could not be found/i)
})

test('an unknown failure falls back to a generic message', () => {
  expect(describeInterviewError(httpError(500))).toMatch(/something went wrong/i)
})
