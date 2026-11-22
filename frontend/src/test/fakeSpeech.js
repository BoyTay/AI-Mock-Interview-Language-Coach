import { act } from '@testing-library/react'

// A stand-in for the Web Speech API: records what is spoken and lets a test fire the events.
export function installFakeSpeech({ voices = [{ lang: 'en-US', name: 'US' }] } = {}) {
  const listeners = new Set()
  const fake = {
    voices,
    spoken: [],
    cancel: vi.fn(),
    get last() {
      return fake.spoken.at(-1)
    },
    start() {
      act(() => fake.last.onstart?.())
    },
    end() {
      act(() => fake.last.onend?.())
    },
    fail(error = 'synthesis-failed') {
      act(() => fake.last.onerror?.({ error }))
    },
    setVoices(list) {
      fake.voices = list
      act(() => listeners.forEach((listener) => listener()))
    },
  }
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => fake.voices,
    speak: (utterance) => fake.spoken.push(utterance),
    cancel: fake.cancel,
    addEventListener: (type, listener) => type === 'voiceschanged' && listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(text) {
        this.text = text
      }
    },
  )
  return fake
}
