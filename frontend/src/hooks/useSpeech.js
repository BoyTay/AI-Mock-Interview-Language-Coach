import { useCallback, useEffect, useRef, useState } from 'react'
import { pickEnglishVoice } from '@/utils/speech'

const synthesis = () => globalThis.speechSynthesis
const currentVoice = () => (synthesis() ? pickEnglishVoice(synthesis().getVoices()) : null)

// Reads text aloud with the browser's English voice. `supported` is false without the
// Web Speech API or without an English voice; voices can arrive after the first render.
// `speak` and `stop` keep their identity, so callers can list them in effect dependencies.
export function useSpeech() {
  const voice = useRef(currentVoice())
  const [supported, setSupported] = useState(() => Boolean(voice.current))
  const [speaking, setSpeaking] = useState(false)
  const latest = useRef(null) // the utterance in progress; also keeps Chrome from dropping its events

  useEffect(() => {
    const synth = synthesis()
    if (!synth) return undefined
    // Chrome can announce voices several times, each time with new objects: keep the
    // choice in a ref so only a change of support re-renders.
    const update = () => {
      voice.current = currentVoice()
      setSupported(Boolean(voice.current))
    }
    update()
    synth.addEventListener?.('voiceschanged', update)
    return () => {
      synth.removeEventListener?.('voiceschanged', update)
      latest.current = null
      synth.cancel()
    }
  }, [])

  const speak = useCallback((text) => {
    const synth = synthesis()
    if (!synth || !voice.current) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice.current
    utterance.lang = voice.current.lang.replace('_', '-')
    utterance.onstart = () => latest.current === utterance && setSpeaking(true)
    const finish = () => {
      if (latest.current !== utterance) return // an older utterance ending late
      latest.current = null
      setSpeaking(false)
    }
    utterance.onend = finish
    utterance.onerror = finish // includes 'not-allowed' when the browser wants a click first
    latest.current = utterance
    synth.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    latest.current = null
    synthesis()?.cancel()
    setSpeaking(false)
  }, [])

  return { supported, speaking, speak, stop }
}
