import { cn } from './utils'

test('cn lets a later Tailwind class override an earlier conflicting one', () => {
  expect(cn('px-2', 'px-4')).toBe('px-4')
})

test('cn drops falsy values', () => {
  expect(cn('a', false && 'b', 'c')).toBe('a c')
})
