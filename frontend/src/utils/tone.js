export function scoreTone(score) {
  if (score >= 80) return 'g'
  if (score >= 60) return 'a'
  return 'r'
}

export function bandColor(band) {
  if (band >= 7) return 'emerald'
  if (band >= 6) return 'amber'
  return 'rose'
}
