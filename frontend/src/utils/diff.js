const words = (s) => s.split(/\s+/).filter(Boolean)

// Word-level diff between what the student wrote and the correction.
// Returns runs of { type: 'same' | 'del' | 'add', text }; a replacement is a 'del' followed by an 'add'.
export function diffWords(original, corrected) {
  const a = words(original)
  const b = words(corrected)

  // lcs[i][j] = longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const runs = []
  const push = (type, word) => {
    const last = runs[runs.length - 1]
    if (last?.type === type) last.words.push(word)
    else runs.push({ type, words: [word] })
  }

  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push('same', a[i++])
      j++
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      push('add', b[j++])
    } else {
      push('del', a[i++])
    }
  }

  // Within a change, show what was removed before what replaced it.
  const ordered = []
  for (const run of runs) {
    const prev = ordered[ordered.length - 1]
    if (run.type === 'del' && prev?.type === 'add') ordered.splice(ordered.length - 1, 0, run)
    else ordered.push(run)
  }
  return ordered.map((r) => ({ type: r.type, text: r.words.join(' ') }))
}
