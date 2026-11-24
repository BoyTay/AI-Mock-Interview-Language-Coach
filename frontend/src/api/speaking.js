import { api } from './client'

// Grading uploads audio and calls Gemini, which can take much longer than the default 15s.
export const EVALUATE_SPEECH_TIMEOUT_MS = 120000

const EXTENSIONS = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav' }

function extensionFor(mimeType) {
  const base = (mimeType ?? '').split(';')[0].trim().toLowerCase()
  return EXTENSIONS[base] ?? 'webm'
}

export async function fetchSpeakingPrompt() {
  const { data } = await api.get('/english/speaking/prompts')
  return data
}

export async function evaluateSpeech({ blob, mimeType, promptText, durationSeconds }) {
  const form = new FormData()
  form.append('audio', new File([blob], `recording.${extensionFor(mimeType)}`, { type: blob.type || mimeType }))
  form.append('prompt_text', promptText)
  form.append('duration_seconds', String(durationSeconds))
  const { data } = await api.post('/english/speaking/evaluate', form, { timeout: EVALUATE_SPEECH_TIMEOUT_MS })
  return data
}

export function describeSpeakingError(error) {
  const response = error.response
  if (!response) {
    if (error.code === 'ECONNABORTED') return 'Grading took too long. Your recording is kept. Try again.'
    return "Can't connect to the server. Check your connection and try again. Your recording is kept."
  }
  const code = response.data?.error?.code
  if (response.status === 422 && code === 'NO_SPEECH_DETECTED') {
    return 'We could not hear any speech. Record again closer to the microphone.'
  }
  if (response.status === 422 && code === 'AUDIO_UNREADABLE') {
    return 'We could not read this recording. Try again, or record again.'
  }
  if (response.status === 429) {
    const wait = Number.parseInt(response.headers?.['retry-after'], 10)
    return wait > 0
      ? `Too many requests. Try again in ${wait} seconds. Your recording is kept.`
      : 'Too many requests. Try again in a moment. Your recording is kept.'
  }
  if (response.status === 413) {
    return 'This recording is too large to send. Record a shorter answer.'
  }
  if (response.status === 415) {
    return "This recording's format is not supported. Try a recent Chrome, Edge, Firefox or Safari."
  }
  if (response.status === 502) {
    return 'The AI returned an answer we could not read. Please try again.'
  }
  if (response.status === 503) {
    return 'The AI service is temporarily unavailable. Please try again in a moment. Your recording is kept.'
  }
  return 'Something went wrong while grading. Please try again.'
}
