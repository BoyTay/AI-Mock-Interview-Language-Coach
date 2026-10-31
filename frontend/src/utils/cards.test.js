import { grammarCard, vocabCard } from './cards'

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
