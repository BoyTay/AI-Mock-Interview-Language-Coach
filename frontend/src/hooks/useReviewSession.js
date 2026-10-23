import { useState } from 'react'

// Drives a flashcard review session over a fixed number of due cards.
// n is the 1-based number of the card on screen; rating is only allowed once the card is flipped.
export function useReviewSession({ deck, total = 15, startAt = 4 }) {
  const [n, setN] = useState(startAt)
  const [flipped, setFlipped] = useState(false)

  const doneCount = Math.min(n - 1, total)

  return {
    n,
    card: deck[(n - 1 + 3) % deck.length],
    flipped,
    finished: n > total,
    doneCount,
    progressPct: Math.round((doneCount / total) * 100),
    flip: () => setFlipped((f) => !f),
    rate: () => {
      if (!flipped) return
      setN((v) => v + 1)
      setFlipped(false)
    },
    restart: () => {
      setN(1)
      setFlipped(false)
    },
  }
}
