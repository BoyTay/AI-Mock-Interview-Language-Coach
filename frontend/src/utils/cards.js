// Flashcard payloads for POST /flashcards, built from what the feedback panel shows.

export function grammarCard(mistake) {
  return {
    source_type: 'GRAMMAR_ERROR',
    front_content: mistake.w,
    back_content: mistake.f,
    explanation: `${mistake.title}: ${mistake.why}`,
  }
}

export function vocabCard(vocab) {
  const levels = [`C1: ${vocab.c1}`]
  if (vocab.c2) levels.push(`C2: ${vocab.c2}`)
  return {
    source_type: 'VOCABULARY',
    front_content: vocab.basic,
    back_content: levels.join('\n'),
    explanation: vocab.example,
  }
}
