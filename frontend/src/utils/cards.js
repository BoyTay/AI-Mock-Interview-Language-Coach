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

const MAX_SIDE_CHARS = 1000 // the API rejects a longer front or back

function clip(text) {
  return text.length > MAX_SIDE_CHARS ? `${text.slice(0, MAX_SIDE_CHARS - 1)}…` : text
}

// A card for a question from the interview report: the AI's own card when it proposed one,
// otherwise the question with its optimal answer, so every question can be saved.
export function conceptCard(question) {
  const optimal = question.reference_answer.map((f) => f.text).join('')
  const proposed = question.mistake_card
  return {
    source_type: 'TECH_CONCEPT',
    front_content: clip(proposed ? proposed.front : question.question),
    back_content: clip(proposed ? proposed.back : optimal),
    explanation: question.turns[0].critique,
  }
}
