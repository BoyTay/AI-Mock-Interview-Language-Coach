import { useCallback, useRef, useState } from 'react'

// Chrome, Edge and Firefox record webm/opus; Safari only records mp4.
const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/mp4']

export const ERROR_MESSAGES = {
  unsupported: "This browser can't record audio. Try a recent version of Chrome, Edge, Firefox or Safari.",
  denied: "Microphone access was blocked. Allow it in your browser's site settings, then try again.",
  missing: 'No microphone was found. Connect one and try again.',
  busy: 'The microphone is in use by another app. Close it and try again.',
  other: 'Could not start recording. Please try again.',
}

export function describeRecorderError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return ERROR_MESSAGES.denied
    case 'NotFoundError':
    case 'OverconstrainedError':
      return ERROR_MESSAGES.missing
    case 'NotReadableError':
    case 'AbortError':
      return ERROR_MESSAGES.busy
    default:
      return ERROR_MESSAGES.other
  }
}

function pickMimeType() {
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function useAudioRecorder() {
  const [status, setStatus] = useState('idle') // idle | recording | recorded | error
  const [error, setError] = useState('')
  const [blob, setBlob] = useState(null)
  const [mimeType, setMimeType] = useState('')
  const recorderRef = useRef(null)

  const fail = useCallback((message) => {
    setError(message)
    setStatus('error')
  }, [])

  const start = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      fail(ERROR_MESSAGES.unsupported)
      return
    }
    setError('')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      fail(describeRecorderError(err))
      return
    }
    const chosen = pickMimeType()
    const recorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined)
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const type = recorder.mimeType || chosen || ''
      setMimeType(type)
      setBlob(new Blob(chunks, { type }))
      setStatus('recorded')
    }
    recorderRef.current = recorder
    recorder.start()
    setStatus('recording')
  }, [fail])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
  }, [])

  const reset = useCallback(() => {
    recorderRef.current = null
    setBlob(null)
    setMimeType('')
    setError('')
    setStatus('idle')
  }, [])

  return { status, error, blob, mimeType, start, stop, reset }
}
