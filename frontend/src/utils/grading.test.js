import { bandDeltaText, toCriteria, toSegments, toVocab } from './grading'

const correction = (original, corrected, category = 'Subject-Verb Agreement') => ({
  original_sentence: original,
  corrected_sentence: corrected,
  error_category: category,
  explanation: `Why ${original} is wrong`,
})

describe('toSegments', () => {
  test('wraps each corrected sentence as a mistake between plain text', () => {
    const essay = 'First sentence. He go home. Last one.'
    const segments = toSegments(essay, [correction('He go home.', 'He goes home.')])

    expect(segments).toEqual([
      'First sentence. ',
      { id: 1, w: 'He go home.', f: 'He goes home.', k: 'Grammar', title: 'Subject-Verb Agreement', why: 'Why He go home. is wrong' },
      ' Last one.',
    ])
  })

  test('turns blank lines into paragraph breaks (null)', () => {
    expect(toSegments('One.\n\nTwo.', [])).toEqual(['One.', null, 'Two.'])
  })

  test('numbers mistakes in the order they appear in the essay', () => {
    const segments = toSegments('A bad. B bad.', [correction('B bad.', 'B good.'), correction('A bad.', 'A good.')])
    const mistakes = segments.filter((s) => s && typeof s === 'object')

    expect(mistakes.map((m) => [m.id, m.w])).toEqual([
      [1, 'A bad.'],
      [2, 'B bad.'],
    ])
  })

  test('skips a correction whose sentence is not in the essay', () => {
    expect(toSegments('Only this.', [correction('Not there.', 'Fixed.')])).toEqual(['Only this.'])
  })

  test('classifies vocabulary-type categories as Vocabulary', () => {
    const [m] = toSegments('Bad word.', [correction('Bad word.', 'Good term.', 'Word Choice')]).filter(
      (s) => s && typeof s === 'object',
    )
    expect(m.k).toBe('Vocabulary')
  })
})

test('toCriteria lists the four criteria with names, bands and feedback', () => {
  const score = (n) => ({ score: n, feedback: `fb ${n}` })
  const criteria = toCriteria({
    task_response: score(7),
    coherence_cohesion: score(7.5),
    lexical_resource: score(6.5),
    grammatical_range: score(6),
  })

  expect(criteria).toEqual([
    { name: 'Task Response', band: 7, feedback: 'fb 7' },
    { name: 'Coherence & Cohesion', band: 7.5, feedback: 'fb 7.5' },
    { name: 'Lexical Resource', band: 6.5, feedback: 'fb 6.5' },
    { name: 'Grammatical Range & Accuracy', band: 6, feedback: 'fb 6' },
  ])
})

test('toVocab maps the API fields to the card fields', () => {
  expect(toVocab([{ basic_word: 'good', advanced_alternative: 'superb', context_example: 'A superb result.' }])).toEqual([
    { basic: 'good', c1: 'superb', example: 'A superb result.' },
  ])
})

describe('bandDeltaText', () => {
  test.each([
    [null, 'First essay of this type'],
    [0.5, '+0.5 vs your previous essay'],
    [-1, '-1.0 vs your previous essay'],
    [0, 'Same as your previous essay'],
  ])('%s -> %s', (delta, text) => expect(bandDeltaText(delta)).toBe(text))
})
