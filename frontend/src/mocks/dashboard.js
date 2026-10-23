// Sample data copied from design/Main.dc.html. Replace with API calls later.

export const metrics = [
  { key: 'sessions', title: 'Total Mock Sessions', value: '48', sub: '+6 sessions vs last week' },
  { key: 'tech', title: 'Avg Technical Score', value: '76', unit: '/ 100', sub: '+4.2 pts vs last week' },
  { key: 'band', title: 'Estimated English Band', value: '6.5', unit: 'IELTS', progress: 72, sub: 'Target band 7.0' },
  { key: 'due', title: 'Due Flashcards Today', value: '23', unit: 'cards', link: { to: '/flashcards', label: 'Start review →' } },
]

export const recentSessions = [
  { type: 'Tech Interview', typeKey: 't', topic: 'Backend Engineer · Database Indexing', score: '84 / 100', tone: 'g', date: 'Oct 17, 2026' },
  { type: 'IELTS Task 2', typeKey: 'e', topic: 'Technology and education essay', score: 'Band 6.5', tone: 'a', date: 'Oct 16, 2026' },
  { type: 'Daily Standup', typeKey: 's', topic: 'Frontend · Sprint update, spoken English', score: 'Band 7.0', tone: 'g', date: 'Oct 14, 2026' },
  { type: 'Tech Interview', typeKey: 't', topic: 'Java Backend · Concurrency', score: '62 / 100', tone: 'a', date: 'Oct 12, 2026' },
  { type: 'IELTS Task 2', typeKey: 'e', topic: 'Remote work and productivity essay', score: 'Band 5.5', tone: 'r', date: 'Oct 10, 2026' },
  { type: 'Tech Interview', typeKey: 't', topic: 'System Design · URL Shortener', score: '71 / 100', tone: 'a', date: 'Oct 8, 2026' },
]

export const radar = {
  labels: ['Backend Architecture', 'Database & SQL', 'Problem Solving', 'English Fluency', 'Grammar/Vocab'],
  current: [72, 85, 68, 74, 62],
  target: 80,
}

export const weekly = {
  tech: [58, 62, 65, 64, 70, 74, 76, 81],
  english: [52, 55, 58, 63, 62, 67, 70, 72],
}
