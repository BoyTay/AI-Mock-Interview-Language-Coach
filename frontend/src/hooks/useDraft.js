import { useCallback, useEffect, useRef, useState } from 'react'

const SAVE_DELAY_MS = 2000

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Keeps an unsent draft in localStorage. Storage can be blocked, so every access is guarded.
export function useDraft(key) {
  const [value, setValueState] = useState(() => read(key) ?? '')
  const [saved, setSaved] = useState(() => read(key) !== null)
  const timer = useRef(null)

  const cancel = () => clearTimeout(timer.current)

  const setValue = useCallback(
    (next) => {
      setValueState(next)
      setSaved(false)
      cancel()
      timer.current = setTimeout(() => {
        try {
          localStorage.setItem(key, next)
          setSaved(true)
        } catch {
          // Storage is blocked or full: the draft stays in memory only.
        }
      }, SAVE_DELAY_MS)
    },
    [key],
  )

  const clear = useCallback(() => {
    cancel()
    setValueState('')
    setSaved(false)
    try {
      localStorage.removeItem(key)
    } catch {
      // Nothing to remove if storage is blocked.
    }
  }, [key])

  useEffect(() => cancel, [])

  return { value, setValue, saved, clear }
}
