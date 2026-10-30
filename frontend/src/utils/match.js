const escapeRegExp = (s) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')

const overlaps = (a, b) => a.start < b.end && b.start < a.end

// Finds `sentence` in `text`, treating any run of whitespace as equal, and skips
// occurrences that overlap a range in `used`. Returns { start, end } or null.
export function findSentence(text, sentence, used = []) {
  const words = sentence.split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  const pattern = new RegExp(words.map(escapeRegExp).join('\\s+'), 'g')
  for (const m of text.matchAll(pattern)) {
    const range = { start: m.index, end: m.index + m[0].length }
    if (!used.some((u) => overlaps(u, range))) return range
  }
  return null
}
