import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createFlashcard } from '@/api/flashcards'
import FeedbackTabs from './FeedbackTabs'

vi.mock('@/api/flashcards', () => ({ createFlashcard: vi.fn() }))

const segments = [
  'Start ',
  { id: 1, w: 'He go home.', f: 'He goes home.', k: 'Grammar', title: 'Subject-verb', why: 'Add -es.' },
  ' middle ',
  { id: 2, w: 'more easy', f: 'easier', k: 'Grammar', title: 'Comparative', why: 'Use -er.' },
]
const vocab = [
  { basic: 'good', c1: 'superb', c2: 'exemplary', example: 'An exemplary result.' },
  { basic: 'big', c1: 'substantial', example: 'A substantial change.' },
]

const save = () => screen.getByRole('button', { name: /Save to Flashcards|Saving|Saved to Flashcards|Try again/ })
const panel = () => within(screen.getByRole('region', { name: 'Mistake explanation' }))
const openVocab = (user) => user.click(screen.getByRole('tab', { name: /Vocabulary Upgrader/ }))

beforeEach(() => {
  createFlashcard.mockReset().mockResolvedValue({ id: 1 })
})

test('a vocabulary card shows the basic word, both levels and the example', async () => {
  const user = userEvent.setup()
  render(<FeedbackTabs segments={[]} vocab={vocab} />)
  await openVocab(user)

  expect(screen.getByText('good')).toBeInTheDocument()
  expect(screen.getByText('superb')).toBeInTheDocument()
  expect(screen.getByText('exemplary')).toBeInTheDocument()
  expect(screen.getByText('An exemplary result.')).toBeInTheDocument()
})

test('saving a vocabulary card sends a VOCABULARY card and then shows it as saved', async () => {
  const user = userEvent.setup()
  render(<FeedbackTabs segments={[]} vocab={vocab} />)
  await openVocab(user)

  await user.click(screen.getAllByRole('button', { name: '+ Save to Flashcards' })[0])

  expect(createFlashcard).toHaveBeenCalledWith({
    source_type: 'VOCABULARY',
    front_content: 'good',
    back_content: 'C1: superb\nC2: exemplary',
    explanation: 'An exemplary result.',
  })
  const saved = await screen.findByRole('button', { name: 'Saved to Flashcards' })
  expect(saved).toBeDisabled()
  expect(screen.getAllByRole('button', { name: '+ Save to Flashcards' })).toHaveLength(1)
})

test('a saved card cannot be saved again', async () => {
  const user = userEvent.setup()
  render(<FeedbackTabs segments={[]} vocab={vocab} />)
  await openVocab(user)
  await user.click(screen.getAllByRole('button', { name: '+ Save to Flashcards' })[0])
  await screen.findByRole('button', { name: 'Saved to Flashcards' })

  await user.click(screen.getByRole('button', { name: 'Saved to Flashcards' }))

  expect(createFlashcard).toHaveBeenCalledTimes(1)
})

test('while saving the button shows progress and a second click does nothing', async () => {
  let finish
  createFlashcard.mockReturnValue(new Promise((resolve) => (finish = resolve)))
  const user = userEvent.setup()
  render(<FeedbackTabs segments={[]} vocab={vocab} />)
  await openVocab(user)

  await user.click(screen.getAllByRole('button', { name: '+ Save to Flashcards' })[0])
  const busy = screen.getByRole('button', { name: 'Saving...' })
  expect(busy).toBeDisabled()
  await user.click(busy)
  expect(createFlashcard).toHaveBeenCalledTimes(1)

  finish({ id: 1 })
  expect(await screen.findByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
})

test('a failed save says so and can be retried', async () => {
  createFlashcard.mockRejectedValueOnce(new Error('down'))
  const user = userEvent.setup()
  render(<FeedbackTabs segments={[]} vocab={vocab} />)
  await openVocab(user)
  await user.click(screen.getAllByRole('button', { name: '+ Save to Flashcards' })[0])

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(createFlashcard).toHaveBeenCalledTimes(2)
})

test('the grammar explanation panel saves the selected mistake as a GRAMMAR_ERROR card', async () => {
  const user = userEvent.setup()
  render(<FeedbackTabs segments={segments} vocab={[]} />)

  await user.click(panel().getByRole('button', { name: '+ Save to Flashcards' }))

  expect(createFlashcard).toHaveBeenCalledWith({
    source_type: 'GRAMMAR_ERROR',
    front_content: 'He go home.',
    back_content: 'He goes home.',
    explanation: 'Subject-verb: Add -es.',
  })
  expect(await panel().findByRole('button', { name: 'Saved to Flashcards' })).toBeDisabled()
})

test('each mistake remembers its own saved state when you switch between them', async () => {
  const user = userEvent.setup()
  render(<FeedbackTabs segments={segments} vocab={[]} />)
  await user.click(panel().getByRole('button', { name: '+ Save to Flashcards' }))
  await panel().findByRole('button', { name: 'Saved to Flashcards' })

  const inText = within(screen.getByRole('group', { name: 'Essay with highlighted mistakes' })).getAllByRole('button')
  await user.click(inText[1])
  expect(panel().getByRole('button', { name: '+ Save to Flashcards' })).toBeInTheDocument()

  await user.click(inText[0])
  expect(panel().getByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
})

test('saved state survives switching tabs', async () => {
  const user = userEvent.setup()
  render(<FeedbackTabs segments={segments} vocab={vocab} />)
  await user.click(panel().getByRole('button', { name: '+ Save to Flashcards' }))
  await panel().findByRole('button', { name: 'Saved to Flashcards' })

  await openVocab(user)
  await user.click(screen.getByRole('tab', { name: /Interactive Error Correction/ }))

  expect(panel().getByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
})
