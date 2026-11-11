// The room keeps its state in the browser: the API has no endpoint to read a transcript back,
// so sessionStorage lets a refresh resume the interview instead of losing it.

const keyFor = (sessionId) => `devcoach.interview.${sessionId}`

function aiMessage(question, at) {
  return { from: 'ai', text: question.text, followUp: question.type === 'FOLLOW_UP', index: question.index, at }
}

export function createSession({ started, role, now = Date.now() }) {
  const { question } = started
  return {
    sessionId: started.session_id,
    role,
    total: question.total,
    startedAt: now,
    transcript: [aiMessage(question, now)],
    current: question,
    complete: false,
  }
}

export function applyAnswer(state, answerText, response, now = Date.now()) {
  const transcript = [...state.transcript, { from: 'user', text: answerText, at: now }]
  const next = response.next_question
  if (next) transcript.push(aiMessage(next, now))
  return { ...state, transcript, current: next ?? null, complete: response.session_complete }
}

export function saveSession(state) {
  try {
    sessionStorage.setItem(keyFor(state.sessionId), JSON.stringify(state))
  } catch {
    // Storage can be full or blocked (private mode); the interview still works, it just will not survive a refresh.
  }
}

export function loadSession(sessionId) {
  try {
    const raw = sessionStorage.getItem(keyFor(sessionId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession(sessionId) {
  try {
    sessionStorage.removeItem(keyFor(sessionId))
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
