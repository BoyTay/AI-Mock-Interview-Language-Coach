import { api } from './client'

// Starting runs retrieval (an embedding call) and answering/finishing call Gemini,
// so all of them can take longer than the default 15s.
const START_TIMEOUT_MS = 60000
const AI_TIMEOUT_MS = 90000

export async function fetchProfile() {
  const { data } = await api.get('/profile')
  return data
}

export async function startInterview({ targetRole, jobDescription, questionCount, difficulties }, { signal } = {}) {
  const body = { target_role: targetRole, question_count: questionCount }
  if (jobDescription?.trim()) body.job_description = jobDescription
  if (difficulties?.length) body.difficulties = difficulties
  const config = signal ? { timeout: START_TIMEOUT_MS, signal } : { timeout: START_TIMEOUT_MS }
  const { data } = await api.post('/interviews/start', body, config)
  return data
}

export async function submitAnswer(sessionId, answer) {
  const { data } = await api.post(`/interviews/${sessionId}/answer`, { answer }, { timeout: AI_TIMEOUT_MS })
  return data
}

export async function finishInterview(sessionId) {
  const { data } = await api.post(`/interviews/${sessionId}/finish`, null, { timeout: AI_TIMEOUT_MS })
  return data
}

export async function fetchReport(sessionId) {
  const { data } = await api.get(`/interviews/${sessionId}/report`)
  return data
}

export function describeInterviewError(error) {
  const response = error.response
  if (!response) {
    return "Can't connect to the server. Check your connection and try again. Your answer is safe."
  }
  const code = response.data?.error?.code
  if (response.status === 429) {
    const wait = Number.parseInt(response.headers?.['retry-after'], 10)
    return wait > 0
      ? `The AI is busy right now. Please try again in ${wait} seconds.`
      : 'The AI is busy right now. Please try again in a moment.'
  }
  if (response.status === 503) {
    return 'The AI service is temporarily unavailable. Please try again in a moment. Your answer is safe.'
  }
  if (response.status === 502) {
    return 'The AI returned an answer we could not read. Please try again.'
  }
  if (code === 'QUESTION_BANK_EMPTY') {
    return 'No interview questions are available yet. Ask an admin to load the question bank.'
  }
  if (code === 'NO_ANSWERS') {
    return 'Answer at least one question before ending the session, so there is something to score.'
  }
  if (code === 'SESSION_NOT_FOUND') {
    return 'This interview session could not be found.'
  }
  return 'Something went wrong. Please try again.'
}
