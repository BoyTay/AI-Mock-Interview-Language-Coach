import { api } from './client'

export const TASK_TYPES = { ielts: 'IELTS_TASK2', standup: 'TECH_STANDUP' }

// Grading calls Gemini, which can take longer than the default 15s.
const EVALUATE_TIMEOUT_MS = 60000

export async function fetchPrompt(task) {
  const { data } = await api.get('/english/writing/prompts', { params: { task_type: TASK_TYPES[task] } })
  return data
}

export async function evaluateEssay({ task, promptTopic, essay }) {
  const { data } = await api.post(
    '/english/writing/evaluate',
    { task_type: TASK_TYPES[task], prompt_topic: promptTopic, user_essay: essay },
    { timeout: EVALUATE_TIMEOUT_MS },
  )
  return data
}

export function describeError(error) {
  const response = error.response
  if (!response) {
    return "Can't connect to the server. Check your connection and try again. Your essay is safe."
  }
  if (response.status === 429) {
    const wait = Number.parseInt(response.headers?.['retry-after'], 10)
    return wait > 0
      ? `The AI is busy right now. Please try again in ${wait} seconds.`
      : 'The AI is busy right now. Please try again in a moment.'
  }
  if (response.status === 502) {
    return 'The AI returned an answer we could not read. Please try again.'
  }
  if (response.status === 422 && response.data?.error?.message) {
    return response.data.error.message
  }
  return 'Something went wrong while grading. Please try again.'
}
