import { api } from './client'

export async function createFlashcard(card) {
  const { data } = await api.post('/flashcards', card)
  return data
}
