export const READ_ALOUD_KEY = 'devcoach.readAloud'

const normalise = (lang = '') => lang.replace('_', '-').toLowerCase()

// American English first, then British, then any English voice the browser has.
export function pickEnglishVoice(voices) {
  const list = voices ?? []
  const byLang = (test) => list.find((v) => test(normalise(v.lang)))
  return (
    byLang((l) => l === 'en-us') ?? byLang((l) => l === 'en-gb') ?? byLang((l) => /^en(-|$)/.test(l)) ?? null
  )
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
