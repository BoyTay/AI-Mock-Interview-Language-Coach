import { act, renderHook } from '@testing-library/react'
import { installFakeSpeech } from '@/test/fakeSpeech'
import { useSpeech } from './useSpeech'

afterEach(() => vi.unstubAllGlobals())

test('is unsupported without speechSynthesis', () => {
  vi.stubGlobal('speechSynthesis', undefined)
  const { result } = renderHook(() => useSpeech())

  expect(result.current.supported).toBe(false)
  expect(() => act(() => result.current.speak('x'))).not.toThrow()
})

test('is unsupported without an English voice', () => {
  installFakeSpeech({ voices: [{ lang: 'vi-VN', name: 'VN' }] })
  const { result } = renderHook(() => useSpeech())

  expect(result.current.supported).toBe(false)
})

test('becomes supported when voices arrive later', () => {
  const fake = installFakeSpeech({ voices: [] })
  const { result } = renderHook(() => useSpeech())
  expect(result.current.supported).toBe(false)

  fake.setVoices([{ lang: 'en-US', name: 'US' }])

  expect(result.current.supported).toBe(true)
})

test('speaks with the English voice and reports speaking until the end', () => {
  const fake = installFakeSpeech({ voices: [{ lang: 'fr-FR', name: 'FR' }, { lang: 'en-US', name: 'US' }] })
  const { result } = renderHook(() => useSpeech())

  act(() => result.current.speak('What is an index?'))
  expect(fake.spoken).toHaveLength(1)
  expect(fake.last.text).toBe('What is an index?')
  expect(fake.last.voice.lang).toBe('en-US')
  expect(fake.last.lang).toBe('en-US')
  expect(result.current.speaking).toBe(false)

  fake.start()
  expect(result.current.speaking).toBe(true)
  fake.end()
  expect(result.current.speaking).toBe(false)
})

test('a refused utterance ends speaking', () => {
  const fake = installFakeSpeech()
  const { result } = renderHook(() => useSpeech())

  act(() => result.current.speak('Hello'))
  fake.start()
  fake.fail('not-allowed')

  expect(result.current.speaking).toBe(false)
})

test('speaking again cancels the previous utterance and its late end is ignored', () => {
  const fake = installFakeSpeech()
  const { result } = renderHook(() => useSpeech())

  act(() => result.current.speak('First'))
  const first = fake.last
  fake.start()
  act(() => result.current.speak('Second'))
  fake.start()
  expect(fake.cancel).toHaveBeenCalled()

  act(() => first.onend())

  expect(result.current.speaking).toBe(true)
})

test('stop cancels and ends speaking', () => {
  const fake = installFakeSpeech()
  const { result } = renderHook(() => useSpeech())
  act(() => result.current.speak('Hello'))
  fake.start()
  fake.cancel.mockClear()

  act(() => result.current.stop())

  expect(fake.cancel).toHaveBeenCalledTimes(1)
  expect(result.current.speaking).toBe(false)
})

test('unmounting cancels the speech', () => {
  const fake = installFakeSpeech()
  const { result, unmount } = renderHook(() => useSpeech())
  act(() => result.current.speak('Hello'))
  fake.cancel.mockClear()

  unmount()

  expect(fake.cancel).toHaveBeenCalled()
})
