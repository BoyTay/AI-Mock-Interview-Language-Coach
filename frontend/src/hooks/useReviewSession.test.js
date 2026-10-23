import { act, renderHook } from '@testing-library/react'
import { deck } from '@/mocks/flashcards'
import { useReviewSession } from './useReviewSession'

const setup = () => renderHook(() => useReviewSession({ deck }))

test('starts at card 4 face-up with 3 cards done', () => {
  const { result } = setup()
  expect(result.current.n).toBe(4)
  expect(result.current.flipped).toBe(false)
  expect(result.current.doneCount).toBe(3)
  expect(result.current.progressPct).toBe(20)
  expect(result.current.finished).toBe(false)
})

test('rating before flipping does nothing', () => {
  const { result } = setup()
  act(() => result.current.rate())
  expect(result.current.n).toBe(4)
})

test('flip then rate advances to the next card face-up', () => {
  const { result } = setup()
  act(() => result.current.flip())
  expect(result.current.flipped).toBe(true)
  act(() => result.current.rate())
  expect(result.current.n).toBe(5)
  expect(result.current.flipped).toBe(false)
})

test('the card follows the design rotation through the deck', () => {
  const { result } = setup()
  expect(result.current.card).toBe(deck[(4 - 1 + 3) % deck.length])
})

test('rating the 15th card finishes the session and restart resets it', () => {
  const { result } = setup()
  for (let i = 0; i < 12; i++) {
    act(() => result.current.flip())
    act(() => result.current.rate())
  }
  expect(result.current.n).toBe(16)
  expect(result.current.finished).toBe(true)
  expect(result.current.doneCount).toBe(15)
  expect(result.current.progressPct).toBe(100)

  act(() => result.current.restart())
  expect(result.current.n).toBe(1)
  expect(result.current.finished).toBe(false)
  expect(result.current.flipped).toBe(false)
})
