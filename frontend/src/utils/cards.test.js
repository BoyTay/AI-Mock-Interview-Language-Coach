import { conceptCard, grammarCard, vocabCard } from './cards'

test('a mistake becomes a GRAMMAR_ERROR card: wrong sentence in front, fix behind, rule as explanation', () => {
  const mistake = { id: 1, w: 'He go home.', f: 'He goes home.', k: 'Grammar', title: 'Subject-verb agreement', why: 'Add -es.' }

  expect(grammarCard(mistake)).toEqual({
    source_type: 'GRAMMAR_ERROR',
    front_content: 'He go home.',
    back_content: 'He goes home.',
    explanation: 'Subject-verb agreement: Add -es.',
  })
})

test('a vocabulary upgrade becomes a VOCABULARY card with both levels and the example', () => {
  const vocab = { basic: 'good', c1: 'superb', c2: 'exemplary', example: 'An exemplary result.' }

  expect(vocabCard(vocab)).toEqual({
    source_type: 'VOCABULARY',
    front_content: 'good',
    back_content: 'C1: superb\nC2: exemplary',
    explanation: 'An exemplary result.',
  })
})

test('a vocabulary upgrade without C2 saves only the C1 line', () => {
  expect(vocabCard({ basic: 'good', c1: 'superb', example: 'A superb idea.' }).back_content).toBe('C1: superb')
})

const REPORT_QUESTION = {
  question: 'Why does an index speed up reads?',
  reference_answer: [
    { text: 'Keys stay ', kind: null },
    { text: 'sorted', kind: 'key' },
    { text: ', so lookups skip a full scan.', kind: null },
  ],
  turns: [{ critique: 'Thiếu chi phí ghi.' }],
  mistake_card: null,
}

test('an interview mistake card from the AI becomes a TECH_CONCEPT card', () => {
  const question = { ...REPORT_QUESTION, mistake_card: { front: 'Cost of an index?', back: 'Slower writes.' } }

  expect(conceptCard(question)).toEqual({
    source_type: 'TECH_CONCEPT',
    front_content: 'Cost of an index?',
    back_content: 'Slower writes.',
    explanation: 'Thiếu chi phí ghi.',
  })
})

test('without an AI card the question and its optimal answer make the card', () => {
  expect(conceptCard(REPORT_QUESTION)).toEqual({
    source_type: 'TECH_CONCEPT',
    front_content: 'Why does an index speed up reads?',
    back_content: 'Keys stay sorted, so lookups skip a full scan.',
    explanation: 'Thiếu chi phí ghi.',
  })
})

test('a long optimal answer is cut to the side limit of the API', () => {
  const question = { ...REPORT_QUESTION, reference_answer: [{ text: 'x'.repeat(1500), kind: null }] }

  const card = conceptCard(question)

  expect(card.back_content).toHaveLength(1000)
  expect(card.back_content.endsWith('…')).toBe(true)
})
