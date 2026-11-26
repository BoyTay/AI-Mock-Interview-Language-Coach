import { formatClock, formatMmSs } from './time'

test('formats seconds as mm:ss', () => {
  expect(formatMmSs(768)).toBe('12:48')
  expect(formatMmSs(0)).toBe('00:00')
  expect(formatMmSs(65)).toBe('01:05')
})

test('clamps negative values to 00:00', () => {
  expect(formatMmSs(-5)).toBe('00:00')
})

test('formatClock writes m:ss without a leading zero on minutes', () => {
  expect(formatClock(0)).toBe('0:00')
  expect(formatClock(30)).toBe('0:30')
  expect(formatClock(84)).toBe('1:24')
  expect(formatClock(120)).toBe('2:00')
  expect(formatClock(600)).toBe('10:00')
})

test('formatClock floors fractions and clamps negatives', () => {
  expect(formatClock(29.9)).toBe('0:29')
  expect(formatClock(-3)).toBe('0:00')
})
