import {
  bandTone,
  pronunciationCard,
  speakingGrammarCard,
  speakingVocabCard,
  toTranscriptSegments,
  wpmVerdict,
} from './speaking'

describe('toTranscriptSegments', () => {
  const transcript = 'Yesterday I, um, fixed the issue and, like, deployed it.'
  const at = (word) => ({ start: transcript.indexOf(word), end: transcript.indexOf(word) + word.length })
  const marks = [
    { kind: 'pronunciation', text: 'deployed', ...at('deployed') },
    { kind: 'filler', text: 'um', ...at('um') },
    { kind: 'pronunciation', text: 'issue', ...at('issue') },
  ]

  it('splits the transcript into text and marks, keeping the text between them verbatim', () => {
    const segments = toTranscriptSegments(transcript, marks)
    expect(segments.map((s) => (s.type === 'text' ? s.text : `[${s.mark.text}]`))).toEqual([
      'Yesterday I, ',
      '[um]',
      ', fixed the ',
      '[issue]',
      ' and, like, ',
      '[deployed]',
      ' it.',
    ])
    expect(
      segments.map((s) => (s.type === 'text' ? s.text : transcript.slice(s.mark.start, s.mark.end))).join(''),
    ).toBe(transcript)
  })

  it('sorts marks by start and gives each the index it has in the marks list', () => {
    const marked = toTranscriptSegments(transcript, marks).filter((s) => s.type === 'mark')
    expect(marked.map((s) => s.index)).toEqual([1, 2, 0])
  })

  it('returns one text segment when there are no marks', () => {
    expect(toTranscriptSegments('Hello there.', [])).toEqual([{ type: 'text', text: 'Hello there.' }])
  })

  it('omits empty text when a mark touches the start or end', () => {
    const head = toTranscriptSegments('um yes', [{ kind: 'filler', text: 'um', start: 0, end: 2 }])
    expect(head.map((s) => s.type)).toEqual(['mark', 'text'])
    const tail = toTranscriptSegments('yes um', [{ kind: 'filler', text: 'um', start: 4, end: 6 }])
    expect(tail.map((s) => s.type)).toEqual(['text', 'mark'])
  })
})

describe('wpmVerdict', () => {
  it.each([
    [109, 'a bit slow', 'amber'],
    [110, 'in range', 'emerald'],
    [160, 'in range', 'emerald'],
    [161, 'a bit fast', 'amber'],
  ])('%i wpm is %s', (wpm, label, tone) => {
    expect(wpmVerdict(wpm)).toEqual({ label, tone })
  })
})

describe('bandTone', () => {
  it.each([
    [7, 'emerald'],
    [6.5, 'amber'],
    [6, 'amber'],
    [5.5, 'rose'],
  ])('band %s is %s', (band, tone) => {
    expect(bandTone(band)).toBe(tone)
  })
})

describe('flashcard builders', () => {
  it('builds a pronunciation card', () => {
    expect(pronunciationCard({ text: 'issue', respelling: 'ISH-oo', note: 'One clear sh.' })).toEqual({
      source_type: 'VOCABULARY',
      front_content: 'issue',
      back_content: 'ISH-oo',
      explanation: 'One clear sh.',
    })
  })

  it('builds a grammar card', () => {
    expect(
      speakingGrammarCard({ original: 'the tests is', corrected: 'the tests are', explanation: 'Plural.' }),
    ).toEqual({
      source_type: 'GRAMMAR_ERROR',
      front_content: 'the tests is',
      back_content: 'the tests are',
      explanation: 'Plural.',
    })
  })

  it('builds a vocabulary card', () => {
    expect(
      speakingVocabCard({ used: 'do a report', better: 'write up a report', explanation: 'Natural.' }),
    ).toEqual({
      source_type: 'VOCABULARY',
      front_content: 'do a report',
      back_content: 'write up a report',
      explanation: 'Natural.',
    })
  })
})
