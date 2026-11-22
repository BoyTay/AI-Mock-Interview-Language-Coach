import { useCallback, useEffect, useRef, useState } from 'react'
import { pickEnglishVoice } from '@/utils/speech'

const synthesis = () => globalThis.speechSynthesis

// Reads text aloud with the browser's English voice. `supported` is false without the
// Web Speech API or without an English voice; voices can arrive after the first render.
export function useSpeech() {
  const [voice, setVoice] = useState(() => (synthesis() ? pickEnglishVoice(synthesis().getVoices()) : null))
  const [speaking, setSpeaking] = useState(false)
  const latest = useRef(null) // the utterance in progress; also keeps Chrome from dropping its events

  useEffect(() => {
    const synth = synthesis()
    if (!synth) return undefined
    const update = () => setVoice(pickEnglishVoice(synth.getVoices()))
    update()
    synth.addEventListener?.('voiceschanged', update)
    return () => {
      synth.removeEventListener?.('voiceschanged', update)
      latest.current = null
      synth.cancel()
    }
  }, [])

  const speak = useCallback(
    (text) => {
      const synth = synthesis()
      if (!synth || !voice) return
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang.replace('_', '-')
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
    },
    [voice],
  )

  const stop = useCallback(() => {
    latest.current = null
    synthesis()?.cancel()
    setSpeaking(false)
  }, [])

  return { supported: Boolean(voice), speaking, speak, stop }
}
