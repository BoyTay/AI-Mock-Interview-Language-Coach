import { findSentence } from './match'

const CRITERIA = [
  ['task_response', 'Task Response'],
  ['coherence_cohesion', 'Coherence & Cohesion'],
  ['lexical_resource', 'Lexical Resource'],
  ['grammatical_range', 'Grammatical Range & Accuracy'],
]

const VOCABULARY_CATEGORY = /vocab|word|collocation|register|spelling/i

const toMistake = (id, written, c) => ({
  id,
  w: written,
  f: c.corrected_sentence,
  k: VOCABULARY_CATEGORY.test(c.error_category) ? 'Vocabulary' : 'Grammar',
  title: c.error_category,
  why: c.explanation,
})

// Plain text becomes strings, with a null wherever a blank line separates paragraphs.
function pushText(segments, text) {
  text.split(/\n\s*\n/).forEach((part, i) => {
    if (i > 0) segments.push(null)
    if (part) segments.push(part)
  })
}

// Places each correction in the essay. `segments` is what the feedback panel renders (plain text,
// paragraph breaks as null, mistakes); `unplaced` holds the corrections whose sentence could not be found.
export function toSegments(essay, corrections) {
  const used = []
  const placed = []
  const missing = []
  for (const c of corrections) {
    const range = findSentence(essay, c.original_sentence, used)
    if (range) {
      used.push(range)
      placed.push({ c, range })
    } else {
      missing.push(c)
    }
  }
  placed.sort((a, b) => a.range.start - b.range.start)

  const segments = []
  let cursor = 0
  placed.forEach(({ c, range }, i) => {
    pushText(segments, essay.slice(cursor, range.start))
    segments.push(toMistake(i + 1, essay.slice(range.start, range.end), c))
    cursor = range.end
  })
  pushText(segments, essay.slice(cursor))

  const unplaced = missing.map((c, i) => toMistake(placed.length + i + 1, c.original_sentence, c))
  return { segments, unplaced }
}

export function toCriteria(bandScores) {
  return CRITERIA.map(([key, name]) => ({ name, band: bandScores[key].score, feedback: bandScores[key].feedback }))
}

export function toVocab(upgraded) {
  return upgraded.map((v) => ({ basic: v.basic_word, c1: v.advanced_alternative, example: v.context_example }))
}

export function bandDeltaText(delta) {
  if (delta === null) return 'First essay of this type'
  if (delta === 0) return 'Same as your previous essay'
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)} vs your previous essay`
}
