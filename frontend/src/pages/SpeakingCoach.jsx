import { useRef, useState } from 'react'
import { describeSpeakingError, evaluateSpeech, fetchSpeakingPrompt } from '@/api/speaking'
import EnglishSwitch from '@/components/english/EnglishSwitch'
import GradingPanel from '@/components/speaking/GradingPanel'
import PracticePanel, { MAX_SECONDS } from '@/components/speaking/PracticePanel'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { usePrompt } from '@/hooks/usePrompt'

export default function SpeakingCoach() {
  const promptState = usePrompt('speaking', fetchSpeakingPrompt)
  const recorder = useAudioRecorder({ maxSeconds: MAX_SECONDS })
  const [phase, setPhase] = useState('idle') // 'idle' | 'grading' | 'graded'
  const [result, setResult] = useState(null)
  const [resultIsPrevious, setResultIsPrevious] = useState(false)
  const [evaluateError, setEvaluateError] = useState(null)
  // A state flag only blocks after the next render; the ref stops a second click in the same tick.
  const inFlight = useRef(false)

  async function evaluate() {
    if (inFlight.current || !recorder.blob || !promptState.prompt) return
    inFlight.current = true
    setPhase('grading')
    setEvaluateError(null)
    try {
      const graded = await evaluateSpeech({
        blob: recorder.blob,
        mimeType: recorder.mimeType,
        promptText: promptState.prompt.prompt,
        durationSeconds: recorder.seconds,
      })
      setResult(graded)
      setResultIsPrevious(false)
      setPhase('graded')
    } catch (e) {
      // The recording stays on screen so the user can retry without speaking again.
      setEvaluateError(describeSpeakingError(e))
      setPhase('idle')
    } finally {
      inFlight.current = false
    }
  }

  async function recordAgain() {
    if (inFlight.current) return
    recorder.reset()
    if (result) setResultIsPrevious(true)
    setEvaluateError(null)
    setPhase('idle')
    await recorder.start()
  }

  function newPrompt() {
    recorder.reset()
    setResult(null)
    setResultIsPrevious(false)
    setEvaluateError(null)
    setPhase('idle')
    promptState.next()
  }

  const gradingPhase = phase === 'grading' ? 'grading' : result ? 'result' : 'empty'

  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-5">
      <h1 className="sr-only">English Speaking Coach</h1>
      <EnglishSwitch />
      <div className="flex flex-wrap items-start gap-5">
        <PracticePanel
          promptState={promptState}
          recorder={recorder}
          phase={phase}
          evaluateError={evaluateError}
          hasResult={Boolean(result)}
          onEvaluate={() => evaluate()}
          onRecordAgain={() => recordAgain()}
          onNewPrompt={newPrompt}
        />
        <div className="flex min-w-0 flex-[1_1_460px] flex-col">
          <GradingPanel key={result?.id ?? 'none'} phase={gradingPhase} result={result} isPrevious={resultIsPrevious} />
        </div>
      </div>
    </div>
  )
}
