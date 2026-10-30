import { bandDeltaText, toCriteria, toSegments, toVocab } from './grading'

const correction = (original, corrected, category = 'Subject-Verb Agreement') => ({
  original_sentence: original,
  corrected_sentence: corrected,
  error_category: category,
  explanation: `Why ${original} is wrong`,
})

const mistakesIn = (segments) => segments.filter((s) => s && typeof s === 'object')

describe('toSegments', () => {
  test('wraps each corrected sentence as a mistake between plain text', () => {
    const essay = 'First sentence. He go home. Last one.'
    const { segments, unplaced } = toSegments(essay, [correction('He go home.', 'He goes home.')])

    expect(segments).toEqual([
      'First sentence. ',
      { id: 1, w: 'He go home.', f: 'He goes home.', k: 'Grammar', title: 'Subject-Verb Agreement', why: 'Why He go home. is wrong' },
      ' Last one.',
    ])
    expect(unplaced).toEqual([])
  })

  test('turns blank lines into paragraph breaks (null)', () => {
    expect(toSegments('One.\n\nTwo.', []).segments).toEqual(['One.', null, 'Two.'])
  })

  test('keeps a paragraph break that sits next to a mistake', () => {
    const { segments } = toSegments('Fine.\n\nHe go. Fine.', [correction('He go.', 'He goes.')])
    expect(segments.map((s) => (s && typeof s === 'object' ? s.w : s))).toEqual(['Fine.', null, 'He go.', ' Fine.'])
  })

  test('numbers mistakes in the order they appear in the essay', () => {
    const { segments } = toSegments('A bad. B bad.', [correction('B bad.', 'B good.'), correction('A bad.', 'A good.')])

    expect(mistakesIn(segments).map((m) => [m.id, m.w])).toEqual([
      [1, 'A bad.'],
      [2, 'B bad.'],
    ])
  })

  test('finds a sentence even when the whitespace differs, keeping the essay wording', () => {
    const { segments, unplaced } = toSegments('Start.  He  go\nhome. End.', [correction('He go home.', 'He goes home.')])
    const [mistake] = mistakesIn(segments)

    expect(mistake.w).toBe('He  go\nhome.')
    expect(mistake.f).toBe('He goes home.')
    expect(unplaced).toEqual([])
  })

  test('a sentence that spans two paragraphs is still placed', () => {
    const { segments, unplaced } = toSegments('He go\n\nhome.', [correction('He go home.', 'He goes home.')])

    expect(mistakesIn(segments)).toHaveLength(1)
    expect(unplaced).toEqual([])
  })

  test('puts a correction whose sentence is not in the essay in unplaced, numbered after the inline ones', () => {
    const { segments, unplaced } = toSegments('Only this one is bad.', [
      correction('Not there.', 'Fixed.'),
      correction('this one is bad.', 'this one is good.'),
    ])

    expect(mistakesIn(segments).map((m) => m.id)).toEqual([1])
    expect(unplaced).toEqual([
      { id: 2, w: 'Not there.', f: 'Fixed.', k: 'Grammar', title: 'Subject-Verb Agreement', why: 'Why Not there. is wrong' },
    ])
  })

  test('the same sentence reported twice is placed at its two occurrences', () => {
    const twice = correction('Bad one.', 'Good one.')
    const { segments, unplaced } = toSegments('Bad one. Bad one.', [twice, twice])

    expect(mistakesIn(segments)).toHaveLength(2)
    expect(unplaced).toEqual([])
  })

  test('the same sentence reported more often than it occurs leaves the extra in unplaced', () => {
    const twice = correction('Bad one.', 'Good one.')
    const { unplaced } = toSegments('Bad one.', [twice, twice])

    expect(unplaced).toHaveLength(1)
  })

  test('classifies vocabulary-type categories as Vocabulary', () => {
    const { segments } = toSegments('Bad word.', [correction('Bad word.', 'Good term.', 'Word Choice')])

    expect(mistakesIn(segments)[0].k).toBe('Vocabulary')
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
