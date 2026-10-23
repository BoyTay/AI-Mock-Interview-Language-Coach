import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Flashcards from '@/pages/Flashcards'

const card = () => screen.getByRole('button', { name: /Flashcard\. Press to flip/ })
const rating = (name) => screen.getByRole('button', { name })
const RATINGS = ['Again', 'Hard', 'Good', 'Easy']

test('starts at card 4 of 15 with rating locked until the card is flipped', () => {
  render(<Flashcards />)
  expect(screen.getByRole('heading', { level: 1, name: 'Mistake Flashcards' })).toBeInTheDocument()
  expect(screen.getByText('Active recall · SM-2')).toBeInTheDocument()
  expect(screen.getByText('Card 4 of 15 due today')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  expect(screen.getByText('Flip the card to rate your recall')).toBeInTheDocument()
  for (const name of RATINGS) expect(rating(new RegExp(`^${name}`))).toBeDisabled()
})

test('flipping enables rating and rating moves to the next card face-up', async () => {
  const user = userEvent.setup()
  render(<Flashcards />)
  await user.click(card())
  expect(card()).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('How well did you remember it?')).toBeInTheDocument()
  expect(rating(/^Good/)).toBeEnabled()

  await user.click(rating(/^Good/))
  expect(screen.getByText('Card 5 of 15 due today')).toBeInTheDocument()
  expect(card()).toHaveAttribute('aria-pressed', 'false')
  expect(rating(/^Good/)).toBeDisabled()
})

test('rating the last card shows the completion state and Restart starts over', async () => {
  const user = userEvent.setup()
  render(<Flashcards />)
  for (let i = 0; i < 12; i++) {
    await user.click(card())
    await user.click(rating(/^Easy/))
  }
  expect(screen.getByText('15 of 15 reviewed')).toBeInTheDocument()
  expect(screen.getByText('Session complete')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Flashcard\. Press to flip/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Again/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Restart session' }))
  expect(screen.getByText('Card 1 of 15 due today')).toBeInTheDocument()
  expect(card()).toHaveAttribute('aria-pressed', 'false')
})

test('the card button exposes the visible face text to assistive tech', async () => {
  const user = userEvent.setup()
  render(<Flashcards />)
  expect(
    screen.getByRole('button', { name: /A query filters on created_at over 30 days/ }),
  ).toBeInTheDocument()

  await user.click(card())
  expect(screen.getByRole('button', { name: /CREATE INDEX ON orders/ })).toBeInTheDocument()
})

test('focus moves to the card after rating and to the completion heading at the end', async () => {
  const user = userEvent.setup()
  render(<Flashcards />)
  await user.click(card())
  await user.click(rating(/^Good/))
  expect(card()).toHaveFocus()

  for (let i = 0; i < 11; i++) {
    await user.click(card())
    await user.click(rating(/^Good/))
  }
  expect(screen.getByRole('heading', { name: 'Session complete' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Restart session' }))
  expect(card()).toHaveFocus()
})
