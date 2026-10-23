import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WritingCoach from '@/pages/WritingCoach'

const mistakes = () => within(screen.getByRole('group', { name: 'Essay with highlighted mistakes' }))
const explanation = () => within(screen.getByRole('region', { name: 'Mistake explanation' }))

test('shows the overall band and the four criteria with threshold colors', () => {
  render(<WritingCoach />)
  expect(screen.getByRole('img', { name: 'Overall band 7.0' })).toBeInTheDocument()
  expect(screen.getByText('Overall Band Score')).toBeInTheDocument()

  const items = within(screen.getByRole('list', { name: 'Criteria scores' })).getAllByRole('listitem')
  expect(items).toHaveLength(4)
  const byName = (name) => items.find((li) => li.textContent.includes(name))
  expect(byName('Task Response')).toHaveTextContent('7.0')
  expect(byName('Coherence & Cohesion').querySelector('.bg-emerald-500')).not.toBeNull()
  expect(byName('Lexical Resource').querySelector('.bg-amber-500')).not.toBeNull()
  expect(byName('Grammatical Range & Accuracy')).toHaveTextContent('6.5')
})

test('tabs show the mistake and vocabulary counts and default to error correction', () => {
  render(<WritingCoach />)
  const errorsTab = screen.getByRole('tab', { name: /Interactive Error Correction/ })
  expect(errorsTab).toHaveAttribute('aria-selected', 'true')
  expect(errorsTab).toHaveTextContent('10')
  expect(screen.getByRole('tab', { name: /Vocabulary Upgrader/ })).toHaveTextContent('6')
})

test('the first mistake is preselected and exactly one is selected at a time', async () => {
  const user = userEvent.setup()
  render(<WritingCoach />)
  const buttons = mistakes().getAllByRole('button')
  expect(buttons).toHaveLength(10)
  expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
  expect(explanation().getByText('Comparative form')).toBeInTheDocument()

  await user.click(buttons[3])
  const pressed = mistakes().getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
  expect(pressed).toHaveLength(1)
  expect(pressed[0]).toBe(buttons[3])
  expect(explanation().getByText('Subject-verb agreement')).toBeInTheDocument()
  expect(explanation().getByText(/"Learners" is plural/)).toBeInTheDocument()
})

test('vocabulary cards can be saved individually and stay saved across tabs', async () => {
  const user = userEvent.setup()
  render(<WritingCoach />)
  await user.click(screen.getByRole('tab', { name: /Vocabulary Upgrader/ }))
  expect(screen.getAllByRole('button', { name: '+ Save to Flashcards' })).toHaveLength(6)

  await user.click(screen.getAllByRole('button', { name: '+ Save to Flashcards' })[0])
  expect(screen.getAllByRole('button', { name: 'Saved to Flashcards' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: '+ Save to Flashcards' })).toHaveLength(5)

  await user.click(screen.getByRole('tab', { name: /Interactive Error Correction/ }))
  await user.click(screen.getByRole('tab', { name: /Vocabulary Upgrader/ }))
  expect(screen.getAllByRole('button', { name: 'Saved to Flashcards' })).toHaveLength(1)
})
