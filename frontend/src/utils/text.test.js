import { countWords } from './text'

test('counts whitespace-separated words', () => {
  expect(countWords(' a  b\nc ')).toBe(3)
})

test('an empty or whitespace-only text has zero words', () => {
  expect(countWords('')).toBe(0)
  expect(countWords('   \n ')).toBe(0)
})
