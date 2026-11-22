export const READ_ALOUD_KEY = 'devcoach.readAloud'

const normalise = (lang = '') => lang.replace('_', '-').toLowerCase()

// macOS lists joke voices (Albert, Bubbles, Zarvox…) among its en-US voices, often first.
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i

// Within a language: the browser's default voice, then one on the device (Chrome's network
// voices stop after about 15 seconds), then any other.
const rank = (v) => (v.default ? 0 : v.localService ? 1 : 2)

// American English first, then British, then any English voice the browser has.
export function pickEnglishVoice(voices) {
  const usable = (voices ?? []).filter((v) => !NOVELTY.test(v.name ?? ''))
  const best = (test) => {
    const matching = usable.filter((v) => test(normalise(v.lang)))
    return matching.length ? matching.reduce((a, b) => (rank(b) < rank(a) ? b : a)) : undefined
  }
  return best((l) => l === 'en-us') ?? best((l) => l === 'en-gb') ?? best((l) => /^en(-|$)/.test(l)) ?? null
}

// 'on' | 'off', or null when the user has not been asked yet (or storage is unavailable).
export function loadReadAloud() {
  try {
    const value = localStorage.getItem(READ_ALOUD_KEY)
    return value === 'on' || value === 'off' ? value : null
  } catch {
    return null
  }
}

export function saveReadAloud(value) {
  try {
    localStorage.setItem(READ_ALOUD_KEY, value)
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
}
