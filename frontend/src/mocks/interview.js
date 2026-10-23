// Sample data copied from design/Interview.dc.html. Replace with API calls later.

export const session = {
  role: 'Java/Python Backend Intern',
  questionNumber: 3,
  total: 6,
  topic: 'Database Indexing',
  elapsedStart: 768,
}

export const question = {
  parts: [
    { t: 'You mentioned B-tree indexes. Given an ' },
    { t: 'orders', code: true },
    {
      t: ' table, write a query for the top 3 customers by total spend in the last 30 days, then tell me which index you would add.',
    },
  ],
  chips: ['SQL', 'Aggregation', 'Composite index'],
  hint: ['WHERE created_at >= …', 'GROUP BY user_id', 'SUM(total)', 'ORDER BY … LIMIT 3', 'Index column order'],
}

export const transcript = [
  {
    from: 'ai',
    text: 'Tell me about a backend project you have built. What was your role and what did you deliver?',
    meta: 'Q1 · 02:10',
  },
  {
    from: 'user',
    text: 'I built a library management API with Flask for my course project. I handled the database design and the borrowing endpoints, then we deployed it with Docker. It worked well.',
    meta: 'Voice · 1:12',
  },
  { from: 'ai', text: 'Why does adding an index speed up reads, and what does it cost?', meta: 'Q2 · 05:36' },
  {
    from: 'user',
    text: 'An index works like a B-tree, so the database can search in logarithmic time instead of scanning the whole table. The trade-off is slower writes and more storage.',
    meta: 'Voice · 0:54',
  },
  {
    from: 'ai',
    followUp: true,
    text: 'Good. You mentioned B-tree indexes, so let us make it concrete. Given an orders table, write a query for the top 3 customers by total spend in the last 30 days, then tell me which index you would add.',
    meta: 'Q3 · 08:02 · awaiting your answer',
  },
]
