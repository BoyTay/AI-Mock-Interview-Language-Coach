import { bandColor, scoreTone } from './tone'

test('scoreTone maps 100-point scores to g, a, r', () => {
  expect(scoreTone(80)).toBe('g')
  expect(scoreTone(79)).toBe('a')
  expect(scoreTone(60)).toBe('a')
  expect(scoreTone(59)).toBe('r')
})

test('bandColor maps IELTS bands to color names', () => {
  expect(bandColor(7)).toBe('emerald')
  expect(bandColor(6.5)).toBe('amber')
  expect(bandColor(5.5)).toBe('rose')
})
