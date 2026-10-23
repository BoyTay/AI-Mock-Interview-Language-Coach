import { formatMmSs } from './time'

test('formats seconds as mm:ss', () => {
  expect(formatMmSs(768)).toBe('12:48')
  expect(formatMmSs(0)).toBe('00:00')
  expect(formatMmSs(65)).toBe('01:05')
})

test('clamps negative values to 00:00', () => {
  expect(formatMmSs(-5)).toBe('00:00')
})
