import { bandColor } from './tone'

// Splits a transcript into plain text and marked words. Marks never overlap; `start` and `end` are
// character offsets. Each mark segment carries `index`, the position of its mark in the `marks` list.
export function toTranscriptSegments(transcript, marks) {
  const ordered = marks.map((mark, index) => ({ mark, index })).sort((a, b) => a.mark.start - b.mark.start)
  const segments = []
  let cursor = 0
  for (const { mark, index } of ordered) {
    if (mark.start > cursor) segments.push({ type: 'text', text: transcript.slice(cursor, mark.start) })
    segments.push({ type: 'mark', index, mark })
    cursor = mark.end
  }
  if (cursor < transcript.length) segments.push({ type: 'text', text: transcript.slice(cursor) })
  return segments
}

export function wpmVerdict(wpm) {
  if (wpm < 110) return { label: 'a bit slow', tone: 'amber' }
  if (wpm > 160) return { label: 'a bit fast', tone: 'amber' }
  return { label: 'in range', tone: 'emerald' }
}

export const bandTone = bandColor

export const pronunciationCard = (mark) => ({
  source_type: 'VOCABULARY',
  front_content: mark.text,
  back_content: mark.respelling,
  explanation: mark.note,
})

export const speakingGrammarCard = (c) => ({
  source_type: 'GRAMMAR_ERROR',
  front_content: c.original,
  back_content: c.corrected,
  explanation: c.explanation,
})

export const speakingVocabCard = (v) => ({
  source_type: 'VOCABULARY',
  front_content: v.used,
  back_content: v.better,
  explanation: v.explanation,
})
