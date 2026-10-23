import { useEffect, useState } from 'react'

export function useTimer({ start, direction = 'up', running = true }) {
  const [seconds, setSeconds] = useState(start)

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => {
      setSeconds((s) => (direction === 'down' ? Math.max(0, s - 1) : s + 1))
    }, 1000)
    return () => clearInterval(id)
  }, [direction, running])

  return seconds
}
