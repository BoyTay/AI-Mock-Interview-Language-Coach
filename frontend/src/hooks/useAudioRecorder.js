import { useCallback, useEffect, useRef, useState } from 'react'

// Chrome, Edge and Firefox record webm/opus; Safari only records mp4.
const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/mp4']
export const DEFAULT_MAX_SECONDS = 180
const LEVEL_INTERVAL_MS = 80

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

function releaseStream(stream) {
  stream?.getTracks().forEach((track) => track.stop())
}

// Measures how loud the voice is, from 0 (silence) to 1, every LEVEL_INTERVAL_MS.
// Returns null when the browser can't analyse audio: the recording still works without it.
function startMeter(stream, onLevel) {
  if (typeof AudioContext === 'undefined') return null
  try {
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    const id = setInterval(() => {
      analyser.getByteTimeDomainData(samples)
      // Samples are bytes centred on 128; the root mean square of the distance is the loudness.
      let sum = 0
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2
      onLevel(Math.min(1, Math.sqrt(sum / samples.length)))
    }, LEVEL_INTERVAL_MS)
    return () => {
      clearInterval(id)
      context.close().catch(() => {})
    }
  } catch {
    return null
  }
}

export function useAudioRecorder({ maxSeconds = DEFAULT_MAX_SECONDS } = {}) {
  const [status, setStatus] = useState('idle') // idle | recording | recorded | error
  const [error, setError] = useState('')
  const [blob, setBlob] = useState(null)
  const [mimeType, setMimeType] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  const [level, setLevel] = useState(0)
  const stopMeterRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const mountedRef = useRef(true)

  const fail = useCallback((message) => {
    setError(message)
    setStatus('error')
  }, [])

  // Stops the recorder without reporting a recording, and turns the microphone off.
  const discard = useCallback(() => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      if (recorder.state === 'recording') recorder.stop()
    }
    stopMeterRef.current?.()
    stopMeterRef.current = null
    releaseStream(streamRef.current)
    streamRef.current = null
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
      if (mountedRef.current) fail(describeRecorderError(err))
      return
    }
    if (!mountedRef.current) {
      // The candidate left while the browser was asking; don't keep the microphone on.
      releaseStream(stream)
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
      stopMeterRef.current?.()
      stopMeterRef.current = null
      releaseStream(streamRef.current)
      streamRef.current = null
      setLevel(0)
      setMimeType(type)
      setBlob(new Blob(chunks, { type }))
      setStatus('recorded')
    }
    streamRef.current = stream
    recorderRef.current = recorder
    setSeconds(0)
    setLimitReached(false)
    stopMeterRef.current = startMeter(stream, setLevel)
    recorder.start()
    setStatus('recording')
  }, [fail])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
  }, [])

  const reset = useCallback(() => {
    discard()
    setBlob(null)
    setMimeType('')
    setError('')
    setSeconds(0)
    setLimitReached(false)
    setLevel(0)
    setStatus('idle')
  }, [discard])

  useEffect(() => {
    if (status !== 'recording') return undefined
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [status])

  useEffect(() => {
    if (status === 'recording' && seconds >= maxSeconds) {
      setLimitReached(true)
      stop()
    }
  }, [status, seconds, maxSeconds, stop])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      discard()
    }
  }, [discard])

  return { status, error, blob, mimeType, seconds, limitReached, level, start, stop, reset }
}
