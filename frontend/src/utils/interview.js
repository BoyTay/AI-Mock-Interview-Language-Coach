export const JD_LIMIT = 6000
export const COUNT_OPTIONS = [4, 6, 8, 10]
const MINUTES_PER_QUESTION = 3

// The design's three levels, mapped onto the levels stored in the question bank.
export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', api: ['JUNIOR'], help: 'Core definitions and common patterns. Few follow-ups.' },
  {
    id: 'medium',
    label: 'Medium',
    api: ['MID'],
    help: 'Typical intern interview. Follow-ups probe the reasoning behind answers.',
  },
  { id: 'hard', label: 'Hard', api: ['SENIOR'], help: 'Edge cases, trade-offs and design questions. Expect pushback.' },
]

export function estimatedMinutes(count) {
  return count * MINUTES_PER_QUESTION
}

export function questionTotalLabel(count) {
  return `${count} ${count === 1 ? 'question' : 'questions'}`
}

// The API takes one answer string, so a code snippet rides along in a fenced block.
export function composeAnswer({ text, code }) {
  const prose = text.trim()
  const snippet = code.trim()
  if (!snippet) return prose
  const block = `\`\`\`\n${snippet}\n\`\`\``
  return prose ? `${prose}\n\n${block}` : block
}

export function deltaText(comparison) {
  if (comparison.previous_average == null) return 'First scored session'
  const average = comparison.previous_average
  if (comparison.delta === 0) return `Same as your ${average} average`
  const sign = comparison.delta > 0 ? '+' : ''
  return `${sign}${comparison.delta} vs your ${average} average`
}
