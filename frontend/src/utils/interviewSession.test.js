import { applyAnswer, clearSession, createSession, loadSession, saveSession } from './interviewSession'

const question = (overrides = {}) => ({
  message_id: 1,
  type: 'MAIN_QUESTION',
  text: 'What is an index?',
  category: 'SQL',
  difficulty: 'MID',
  index: 1,
  total: 6,
  ...overrides,
})

const started = { session_id: 7, question: question() }

afterEach(() => sessionStorage.clear())

test('a new session starts with the first question in the transcript', () => {
  const state = createSession({ started, role: 'Java Dev', now: 1000 })

  expect(state).toMatchObject({ sessionId: 7, role: 'Java Dev', total: 6, startedAt: 1000, complete: false })
  expect(state.current.text).toBe('What is an index?')
  expect(state.transcript).toEqual([
    { from: 'ai', text: 'What is an index?', followUp: false, index: 1, at: 1000 },
  ])
})

test('an answer adds the user message and the next main question', () => {
  const state = createSession({ started, role: 'Java Dev', now: 1000 })
  const response = {
    next_question: question({ message_id: 3, text: 'What is a join?', index: 2 }),
    session_complete: false,
  }

  const next = applyAnswer(state, 'It speeds up reads.', response, 2000)

  expect(next.current).toMatchObject({ text: 'What is a join?', index: 2 })
  expect(next.transcript.map((m) => [m.from, m.text, m.followUp])).toEqual([
    ['ai', 'What is an index?', false],
    ['user', 'It speeds up reads.', undefined],
    ['ai', 'What is a join?', false],
  ])
  expect(next.complete).toBe(false)
})

test('a follow-up question is marked as one and keeps the question number', () => {
  const state = createSession({ started, role: 'Java Dev', now: 1000 })
  const response = {
    next_question: question({ message_id: 3, type: 'FOLLOW_UP', text: 'What about writes?' }),
    session_complete: false,
  }

  const next = applyAnswer(state, 'Fast reads.', response, 2000)

  expect(next.transcript.at(-1)).toMatchObject({ from: 'ai', followUp: true, index: 1 })
  expect(next.current.type).toBe('FOLLOW_UP')
})

test('the last answer completes the session and leaves no current question', () => {
  const state = createSession({ started, role: 'Java Dev', now: 1000 })

  const next = applyAnswer(state, 'Done.', { next_question: null, session_complete: true }, 2000)

  expect(next.complete).toBe(true)
  expect(next.current).toBeNull()
  expect(next.transcript.at(-1)).toMatchObject({ from: 'user', text: 'Done.' })
})

test('applying an answer does not change the previous state', () => {
  const state = createSession({ started, role: 'Java Dev', now: 1000 })

  applyAnswer(state, 'Answer', { next_question: null, session_complete: true }, 2000)

  expect(state.transcript).toHaveLength(1)
  expect(state.complete).toBe(false)
})

test('a saved session can be loaded again by id', () => {
  const state = createSession({ started, role: 'Java Dev', now: 1000 })

  saveSession(state)

  expect(loadSession(7)).toEqual(state)
})

test('loading a session that was never saved gives null', () => {
  expect(loadSession(99)).toBeNull()
})

test('a cleared session is gone', () => {
  saveSession(createSession({ started, role: 'Java Dev', now: 1000 }))

  clearSession(7)

  expect(loadSession(7)).toBeNull()
})

test('corrupt stored data is treated as no session', () => {
  sessionStorage.setItem('devcoach.interview.7', '{not json')

  expect(loadSession(7)).toBeNull()
})

test('storage that throws does not break the page', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })

  expect(() => saveSession(createSession({ started, role: 'Java Dev', now: 1000 }))).not.toThrow()
  spy.mockRestore()
})
