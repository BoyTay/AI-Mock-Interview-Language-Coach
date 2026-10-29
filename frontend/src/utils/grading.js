const CRITERIA = [
  ['task_response', 'Task Response'],
  ['coherence_cohesion', 'Coherence & Cohesion'],
  ['lexical_resource', 'Lexical Resource'],
  ['grammatical_range', 'Grammatical Range & Accuracy'],
]

const VOCABULARY_CATEGORY = /vocab|word|collocation|register|spelling/i

// Splits the essay into plain text, paragraph breaks (null) and mistakes, the shape the feedback panel renders.
export function toSegments(essay, corrections) {
  const segments = []
  let id = 0
  essay.split(/\n\s*\n/).forEach((paragraph, p) => {
    if (p > 0) segments.push(null)
    const found = corrections
      .map((c) => ({ c, at: paragraph.indexOf(c.original_sentence) }))
      .filter(({ at }) => at >= 0)
      .sort((a, b) => a.at - b.at)

    let cursor = 0
    for (const { c, at } of found) {
      if (at < cursor) continue
      if (at > cursor) segments.push(paragraph.slice(cursor, at))
      segments.push({
        id: ++id,
        w: c.original_sentence,
        f: c.corrected_sentence,
        k: VOCABULARY_CATEGORY.test(c.error_category) ? 'Vocabulary' : 'Grammar',
        title: c.error_category,
        why: c.explanation,
      })
      cursor = at + c.original_sentence.length
    }
    if (cursor < paragraph.length) segments.push(paragraph.slice(cursor))
  })
  return segments
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
