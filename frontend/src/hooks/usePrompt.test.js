import { renderHook, waitFor } from '@testing-library/react'
import { usePrompt } from './usePrompt'

test('loads the prompt through the given fetcher', async () => {
  const prompt = { id: 'sp-01', prompt: 'Describe your day' }
  const fetcher = vi.fn().mockResolvedValue(prompt)

  const { result } = renderHook(() => usePrompt('standup', fetcher))

  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.prompt).toEqual(prompt)
  expect(fetcher).toHaveBeenCalledWith('standup')
})
