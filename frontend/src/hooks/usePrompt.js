import { useCallback, useEffect, useState } from 'react'
import { fetchPrompt } from '@/api/writing'

const MAX_REPEAT_RETRIES = 3

// Loads a random prompt for the task. `next` asks for a different one than the current.
export function usePrompt(task, fetcher = fetchPrompt) {
  const [state, setState] = useState({ status: 'loading', prompt: null, round: 0 })

  const load = useCallback(
    async (previousId) => {
      setState((s) => ({ ...s, status: 'loading' }))
      try {
        let prompt = await fetcher(task)
        for (let i = 0; i < MAX_REPEAT_RETRIES && previousId && prompt.id === previousId; i++) {
          prompt = await fetcher(task)
        }
        setState((s) => ({ status: 'ready', prompt, round: s.round + 1 }))
      } catch {
        setState((s) => ({ ...s, status: 'error' }))
      }
    },
    [task, fetcher],
  )

  useEffect(() => {
    load()
  }, [load])

  return { ...state, next: () => load(state.prompt?.id), retry: () => load() }
}
