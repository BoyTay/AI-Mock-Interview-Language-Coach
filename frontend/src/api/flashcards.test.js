import { api } from './client'
import { createFlashcard } from './flashcards'

afterEach(() => vi.restoreAllMocks())

test('createFlashcard posts the card and returns the saved one', async () => {
  const saved = { id: 3, source_type: 'VOCABULARY' }
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: saved })
  const card = { source_type: 'VOCABULARY', front_content: 'good', back_content: 'C1: superb', explanation: null }

  expect(await createFlashcard(card)).toEqual(saved)
  expect(post).toHaveBeenCalledWith('/flashcards', card)
})
