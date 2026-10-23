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

export const report = {
  title: 'Interview Evaluation Report',
  role: 'Java/Python Backend Intern',
  meta: '6 questions · 31:40 · Oct 18, 2026',
  overall: 82,
  headline: 'Strong performance',
  summary: 'Solid database fundamentals. Concurrency answers need more depth.',
  delta: '+6 vs your 76 average',
  star: {
    percent: 78,
    letters: [
      { k: 'S', label: 'Situation', good: true },
      { k: 'T', label: 'Task', good: true },
      { k: 'A', label: 'Action', good: true },
      { k: 'R', label: 'Result', good: false },
    ],
    note: 'Results were rarely quantified in behavioral answers.',
  },
  strengths: [
    { title: 'Database indexing', text: 'Named the B-tree complexity and the write-cost trade-off correctly.' },
    { title: 'Clear spoken delivery', text: 'Structured answers with very few filler words.' },
    { title: 'API design reasoning', text: 'Connected idempotency to safe retries and idempotency keys.' },
  ],
  gaps: [
    { title: 'Race conditions & atomics', level: 'High', text: 'Did not explain read-modify-write or name atomic alternatives.' },
    { title: 'Composite index design', level: 'Medium', text: 'Column order and covering indexes were not considered.' },
    { title: 'Quantified results', level: 'Medium', text: 'STAR answers ended without a measurable outcome.' },
  ],
}

// Highlight kinds (h): '' plain, 'r' rose gap, 'a' amber gap, 'g' emerald key point, 'c' inline code.
export const reportQuestions = [
  {
    n: 1,
    title: 'Tell me about a backend project you have built. What was your role and what did you deliver?',
    topic: 'Behavioral · STAR',
    sc: 78,
    dur: '1:12',
    tags: [
      { text: 'Clear role ownership', tone: 'g' },
      { text: 'Situation context missing', tone: 'a' },
      { text: 'Result not quantified', tone: 'r' },
    ],
    user: [
      { t: 'I built a library management API with Flask for my course project. I handled the database design and the borrowing endpoints, then we deployed it with Docker. ', h: '' },
      { t: 'It worked well.', h: 'r' },
    ],
    ref: [
      { t: 'For our course project, my team needed a system to track book loans. ', h: 'g' },
      { t: 'I owned the schema design and the borrowing endpoints. I normalised the tables, indexed the member column and containerised the service with Docker. ', h: '' },
      { t: 'As an example result: loan lookups dropped from about 400 ms to 40 ms and the demo ran without downtime.', h: 'g' },
    ],
  },
  {
    n: 2,
    title: 'Why does adding an index speed up reads, and what does it cost?',
    topic: 'Database Indexing',
    sc: 88,
    dur: '0:54',
    tags: [
      { text: 'Correct B-tree complexity', tone: 'g' },
      { text: 'Trade-offs named', tone: 'g' },
      { text: 'Selectivity not mentioned', tone: 'a' },
    ],
    user: [
      { t: 'An index works like a B-tree, so the database can search in logarithmic time instead of scanning the whole table. ', h: '' },
      { t: 'The trade-off is slower writes and more storage.', h: 'a' },
    ],
    ref: [
      { t: 'A B-tree index keeps keys sorted, so lookups, range scans and ORDER BY avoid a full table scan: O(log n) instead of O(n). ', h: 'g' },
      { t: 'Every INSERT, UPDATE or DELETE must also maintain the index, and indexes consume disk and memory. ', h: '' },
      { t: 'Index high-selectivity columns used in WHERE, JOIN and ORDER BY, and avoid over-indexing write-heavy tables.', h: 'g' },
    ],
  },
  {
    n: 3,
    title: 'Write a query for the top 3 customers by total spend in the last 30 days, then tell me which index you would add.',
    topic: 'SQL · Follow-up',
    sc: 85,
    dur: '1:31',
    tags: [
      { text: 'Correct aggregation logic', tone: 'g' },
      { text: 'Index column order', tone: 'a' },
      { text: 'Covering index not considered', tone: 'a' },
    ],
    user: [
      { t: 'I would filter the last thirty days, group by user_id, sum the totals, order descending and limit three. ', h: '' },
      { t: 'For the index I would add one on user_id.', h: 'a' },
    ],
    ref: [
      {
        t: "SELECT user_id, SUM(total) AS spend FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY user_id ORDER BY spend DESC LIMIT 3;",
        h: 'c',
      },
      { t: ' A composite index on (created_at, user_id) lets the database range-scan the date window and read user_id from the index. Adding total makes it a covering index.', h: 'g' },
    ],
  },
  {
    n: 4,
    title: 'Which HTTP methods are idempotent, and why does it matter for retries?',
    topic: 'REST API Design',
    sc: 90,
    dur: '0:48',
    tags: [
      { text: 'Accurate method list', tone: 'g' },
      { text: 'Idempotency key mentioned', tone: 'g' },
      { text: 'A payment example would help', tone: 'a' },
    ],
    user: [
      { t: 'GET, PUT and DELETE are idempotent, so repeating them leaves the server in the same state. This matters because a client can safely retry after a timeout. POST is not, so I would use an idempotency key.', h: '' },
    ],
    ref: [
      { t: 'GET, HEAD, PUT and DELETE are idempotent: repeating the call leaves the same server state. ', h: 'g' },
      { t: 'That makes retries after a timeout safe. POST is not idempotent, so for something like a payment the client sends an idempotency key and the server de-duplicates. ', h: '' },
      { t: 'PATCH depends on the implementation.', h: 'g' },
    ],
  },
  {
    n: 5,
    title: 'What can go wrong when two threads update a shared counter in Java, and how do you fix it?',
    topic: 'Concurrency',
    sc: 66,
    dur: '0:37',
    tags: [
      { text: 'Race condition not named', tone: 'r' },
      { text: 'No atomic alternatives', tone: 'a' },
      { text: 'Reached a valid fix', tone: 'g' },
    ],
    user: [
      { t: 'It can give a wrong number. ', h: 'r' },
      { t: 'You can use synchronized to fix it.', h: 'a' },
    ],
    ref: [
      { t: 'counter++ is a read-modify-write, not an atomic step, so two threads can read the same value and one update is lost. This is a race condition. ', h: 'g' },
      { t: 'Fix it with synchronized, a ReentrantLock, or AtomicInteger.incrementAndGet(), which uses compare-and-swap and avoids blocking. ', h: 'g' },
      { t: 'In Python the GIL does not make += atomic either, so use threading.Lock.', h: '' },
    ],
  },
  {
    n: 6,
    title: 'Tell me about a time you debugged a difficult problem.',
    topic: 'Behavioral · STAR',
    sc: 84,
    dur: '1:25',
    tags: [
      { text: 'Full STAR structure', tone: 'g' },
      { text: 'Root cause identified', tone: 'g' },
      { text: 'Metrics would strengthen Result', tone: 'a' },
    ],
    user: [
      { t: 'In our group project the API returned 500 errors under load. I was asked to find the cause. I added logging, found that database connections were never closed, and wrapped them in a context manager. ', h: '' },
      { t: 'The errors stopped and the next demo was stable.', h: 'a' },
    ],
    ref: [
      { t: 'Our API returned 500 errors under load, and I owned the investigation. ', h: '' },
      { t: 'I added structured logging, traced the failures to unclosed database connections and fixed it with a context manager. ', h: 'g' },
      { t: 'Error rate fell from about 8% to zero across a 200-request load test.', h: 'g' },
    ],
  },
]
