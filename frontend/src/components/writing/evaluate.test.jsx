import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { evaluateEssay, fetchPrompt } from '@/api/writing'
import WritingCoach from '@/pages/WritingCoach'

vi.mock('@/api/writing', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPrompt: vi.fn(),
  evaluateEssay: vi.fn(),
}))

const STANDUP = {
  id: 'standup-01',
  task_type: 'TECH_STANDUP',
  prompt: 'Write your daily standup update.',
  min_words: 5,
  max_words: 120,
  suggested_minutes: 5,
}
const ESSAY = 'Yesterday I fix the login bug. Today I will write tests.\n\nNo blockers today.'

const RESULT = {
  id: 7,
  overall_band: 6.5,
  band_delta: 0.5,
  band_scores: {
    task_response: { score: 7, feedback: 'Covers the task.' },
    coherence_cohesion: { score: 6, feedback: 'Clear order.' },
    lexical_resource: { score: 5.5, feedback: 'Basic words.' },
    grammatical_range: { score: 6.5, feedback: 'Some slips.' },
  },
  sentence_corrections: [
    {
      original_sentence: 'Yesterday I fix the login bug.',
      corrected_sentence: 'Yesterday I fixed the login bug.',
      error_category: 'Verb Tense',
      explanation: 'Use the past tense for yesterday.',
    },
  ],
  upgraded_vocab: [{ basic_word: 'fix', advanced_alternative: 'resolve', context_example: 'I resolved the bug.' }],
}

const essayBox = () => screen.getByLabelText('Your essay')
const evaluateButton = () => screen.getByRole('button', { name: /Evaluate with AI|Evaluating/ })

async function renderStandup() {
  const user = userEvent.setup()
  render(<WritingCoach />)
  await user.click(screen.getByRole('button', { name: 'Tech Daily Standup' }))
  await screen.findByText(STANDUP.prompt)
  return user
}

const typeEssay = (user, text = ESSAY) => user.type(essayBox(), text.replaceAll('\n', '{Enter}'))

beforeEach(() => {
  localStorage.clear()
  fetchPrompt.mockReset().mockResolvedValue(STANDUP)
  evaluateEssay.mockReset().mockResolvedValue(RESULT)
})

test('the grading area starts with a hint instead of a score', async () => {
  await renderStandup()
  expect(screen.getByText(/to see your band score/)).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /Overall band/ })).not.toBeInTheDocument()
})

test('Evaluate is disabled below the minimum word count and enabled at it', async () => {
  const user = await renderStandup()
  expect(evaluateButton()).toBeDisabled()

  await user.type(essayBox(), 'one two three four')
  expect(evaluateButton()).toBeDisabled()

  await user.type(essayBox(), ' five')
  expect(evaluateButton()).toBeEnabled()
})

test('Evaluate sends the task, prompt and essay', async () => {
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())

  expect(evaluateEssay).toHaveBeenCalledWith({ task: 'standup', promptTopic: STANDUP.prompt, essay: ESSAY })
})

test('while grading the button shows loading and cannot be pressed twice', async () => {
  let finish
  evaluateEssay.mockReturnValue(new Promise((resolve) => (finish = resolve)))
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())

  expect(screen.getByRole('button', { name: /Evaluating/ })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /Evaluating/ }))
  expect(evaluateEssay).toHaveBeenCalledTimes(1)

  finish(RESULT)
  expect(await screen.findByRole('img', { name: 'Overall band 6.5' })).toBeInTheDocument()
  expect(evaluateButton()).toBeEnabled()
})

test('shows the real overall band, delta and four criteria with threshold colors', async () => {
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())

  expect(await screen.findByRole('img', { name: 'Overall band 6.5' })).toBeInTheDocument()
  expect(screen.getByText('+0.5 vs your previous essay')).toBeInTheDocument()

  const items = within(screen.getByRole('list', { name: 'Criteria scores' })).getAllByRole('listitem')
  expect(items).toHaveLength(4)
  const byName = (name) => items.find((li) => li.textContent.includes(name))
  expect(byName('Task Response').querySelector('.bg-emerald-500')).not.toBeNull()
  expect(byName('Coherence & Cohesion').querySelector('.bg-amber-500')).not.toBeNull()
  expect(byName('Lexical Resource').querySelector('.bg-rose-500')).not.toBeNull()
  expect(byName('Lexical Resource')).toHaveTextContent('Basic words.')
})

test('highlights the corrected sentence and counts mistakes and vocabulary in the tabs', async () => {
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())

  const group = await screen.findByRole('group', { name: 'Essay with highlighted mistakes' })
  expect(within(group).getByRole('button')).toHaveTextContent('Yesterday I fix fixed the login bug.')
  expect(screen.getByRole('tab', { name: /Interactive Error Correction/ })).toHaveTextContent('1')
  expect(screen.getByRole('tab', { name: /Vocabulary Upgrader/ })).toHaveTextContent('1')
  expect(screen.getByText('Use the past tense for yesterday.')).toBeInTheDocument()
})

test('a network error shows a friendly message and keeps the essay', async () => {
  evaluateEssay.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }))
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())

  expect(await screen.findByRole('alert')).toHaveTextContent(/connect to the server/i)
  expect(essayBox().value).toBe(ESSAY)
  expect(evaluateButton()).toBeEnabled()
})

test('a rate limit shows how long to wait and keeps the essay', async () => {
  evaluateEssay.mockRejectedValue(
    Object.assign(new Error('429'), { response: { status: 429, data: {}, headers: { 'retry-after': '20' } } }),
  )
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())

  expect(await screen.findByRole('alert')).toHaveTextContent('20 seconds')
  expect(essayBox().value).toBe(ESSAY)
})

test('a later success clears the earlier error', async () => {
  evaluateEssay.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(RESULT)
  const user = await renderStandup()
  await typeEssay(user)
  await user.click(evaluateButton())
  await screen.findByRole('alert')

  await user.click(evaluateButton())

  expect(await screen.findByRole('img', { name: 'Overall band 6.5' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
