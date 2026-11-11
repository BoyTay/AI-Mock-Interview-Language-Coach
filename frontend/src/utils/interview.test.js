import {
  COUNT_OPTIONS,
  DIFFICULTIES,
  JD_LIMIT,
  composeAnswer,
  deltaText,
  estimatedMinutes,
  questionTotalLabel,
} from './interview'

test('each difficulty maps to the API level of the question bank', () => {
  expect(DIFFICULTIES.map((d) => [d.id, d.api])).toEqual([
    ['easy', ['JUNIOR']],
    ['medium', ['MID']],
    ['hard', ['SENIOR']],
  ])
})

test('the question counts match the design and fit the API limit', () => {
  expect(COUNT_OPTIONS).toEqual([4, 6, 8, 10])
})

test('the job description limit matches the design', () => {
  expect(JD_LIMIT).toBe(6000)
})

test('the estimate is about three minutes per question', () => {
  expect(estimatedMinutes(6)).toBe(18)
  expect(estimatedMinutes(10)).toBe(30)
})

test('a plain text answer is sent as typed, trimmed', () => {
  expect(composeAnswer({ text: '  An index speeds up reads.  ', code: '' })).toBe('An index speeds up reads.')
})

test('a code snippet is appended in a fenced block', () => {
  const answer = composeAnswer({ text: 'Use a composite index.', code: 'CREATE INDEX i ON t (a, b);' })

  expect(answer).toBe('Use a composite index.\n\n```\nCREATE INDEX i ON t (a, b);\n```')
})

test('a code-only answer has no leading blank lines', () => {
  expect(composeAnswer({ text: '  ', code: 'SELECT 1;' })).toBe('```\nSELECT 1;\n```')
})

test('whitespace-only text and code give an empty answer', () => {
  expect(composeAnswer({ text: ' \n', code: '  ' })).toBe('')
})

test('the question total label is singular for one question', () => {
  expect(questionTotalLabel(1)).toBe('1 question')
  expect(questionTotalLabel(6)).toBe('6 questions')
})

test('the delta text compares with the average of earlier sessions', () => {
  expect(deltaText({ previous_average: 76, previous_sessions: 3, delta: 6 })).toBe('+6 vs your 76 average')
  expect(deltaText({ previous_average: 80, previous_sessions: 1, delta: -4.5 })).toBe('-4.5 vs your 80 average')
  expect(deltaText({ previous_average: 80, previous_sessions: 1, delta: 0 })).toBe('Same as your 80 average')
})

test('the first session has no comparison text', () => {
  expect(deltaText({ previous_average: null, previous_sessions: 0, delta: null })).toBe('First scored session')
})
