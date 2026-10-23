import { act, renderHook } from '@testing-library/react'
import { useTimer } from './useTimer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('counts up once per second', () => {
  const { result } = renderHook(() => useTimer({ start: 768 }))
  act(() => vi.advanceTimersByTime(2000))
  expect(result.current).toBe(770)
})

test('counts down and stops at zero, never negative', () => {
  const { result } = renderHook(() => useTimer({ start: 2, direction: 'down' }))
  act(() => vi.advanceTimersByTime(5000))
  expect(result.current).toBe(0)
})

test('does not tick while not running', () => {
  const { result } = renderHook(() => useTimer({ start: 10, running: false }))
  act(() => vi.advanceTimersByTime(3000))
  expect(result.current).toBe(10)
})

test('clears its interval on unmount', () => {
  const { unmount } = renderHook(() => useTimer({ start: 0 }))
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
