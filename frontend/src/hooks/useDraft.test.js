import { act, renderHook } from '@testing-library/react'
import { useDraft } from './useDraft'

const KEY = 'writing-draft:ielts'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

test('starts from the saved draft and counts it as saved', () => {
  localStorage.setItem(KEY, 'my draft')
  const { result } = renderHook(() => useDraft(KEY))

  expect(result.current.value).toBe('my draft')
  expect(result.current.saved).toBe(true)
})

test('starts empty when there is no draft', () => {
  const { result } = renderHook(() => useDraft(KEY))
  expect(result.current.value).toBe('')
})

test('saves a few seconds after the last keystroke, not on every one', () => {
  const { result } = renderHook(() => useDraft(KEY))

  act(() => result.current.setValue('He'))
  act(() => vi.advanceTimersByTime(1500))
  act(() => result.current.setValue('Hello'))
  act(() => vi.advanceTimersByTime(1500))
  expect(localStorage.getItem(KEY)).toBeNull()
  expect(result.current.saved).toBe(false)

  act(() => vi.advanceTimersByTime(1000))
  expect(localStorage.getItem(KEY)).toBe('Hello')
  expect(result.current.saved).toBe(true)
})

test('clear removes the draft and any pending save', () => {
  localStorage.setItem(KEY, 'old')
  const { result } = renderHook(() => useDraft(KEY))

  act(() => result.current.setValue('new'))
  act(() => result.current.clear())
  act(() => vi.advanceTimersByTime(5000))

  expect(localStorage.getItem(KEY)).toBeNull()
  expect(result.current.value).toBe('')
})

test('still works when localStorage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const { result } = renderHook(() => useDraft(KEY))

  act(() => result.current.setValue('typing'))
  act(() => vi.advanceTimersByTime(3000))

  expect(result.current.value).toBe('typing')
  expect(result.current.saved).toBe(false)
  vi.restoreAllMocks()
})
