import { findSentence } from './match'

const slice = (text, m) => text.slice(m.start, m.end)

test('finds an exact sentence', () => {
  const text = 'First one. He go home. Last one.'
  expect(slice(text, findSentence(text, 'He go home.'))).toBe('He go home.')
})

test('tolerates different whitespace, including a line break inside the sentence', () => {
  const text = 'First one. He  go\nhome. Last one.'
  const match = findSentence(text, 'He go home.')
  expect(slice(text, match)).toBe('He  go\nhome.')
})

test('ignores spaces around the sentence in the AI answer', () => {
  const text = 'First one. He go home. Last one.'
  expect(slice(text, findSentence(text, '  He go home. '))).toBe('He go home.')
})

test('treats regex characters in the sentence literally', () => {
  const text = 'Is it (really) true? Yes.'
  expect(slice(text, findSentence(text, 'Is it (really) true?'))).toBe('Is it (really) true?')
})

test('returns null when the sentence is not in the text', () => {
  expect(findSentence('Some text.', 'Not here.')).toBeNull()
})

test('returns null for a blank sentence', () => {
  expect(findSentence('Some text.', '   ')).toBeNull()
})

test('skips an occurrence that overlaps a range already used', () => {
  const text = 'Bad one. Bad one.'
  const first = findSentence(text, 'Bad one.', [])
  const second = findSentence(text, 'Bad one.', [first])

  expect(first).toEqual({ start: 0, end: 8 })
  expect(second).toEqual({ start: 9, end: 17 })
  expect(findSentence(text, 'Bad one.', [first, second])).toBeNull()
})
