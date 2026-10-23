import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewRoom from '@/pages/InterviewRoom'

async function openReport() {
  const user = userEvent.setup()
  render(<InterviewRoom />)
  await user.click(screen.getByRole('button', { name: 'Post-Interview Evaluation Report' }))
  return user
}

const headers = () => screen.getAllByRole('button', { name: /^Q\d/ })
const openOnes = () => headers().filter((h) => h.getAttribute('aria-expanded') === 'true')

test('the preview switch moves between the room and the report', async () => {
  const user = await openReport()
  expect(screen.getByRole('heading', { level: 1, name: 'Interview Evaluation Report' })).toBeInTheDocument()
  expect(screen.queryByRole('log', { name: 'Live transcript' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Active Interview Room' }))
  expect(screen.getByRole('log', { name: 'Live transcript' })).toBeInTheDocument()
})

test('summary shows the score ring, STAR compliance, strengths and gaps', async () => {
  await openReport()
  expect(screen.getByRole('img', { name: '82 out of 100' })).toBeInTheDocument()
  expect(screen.getByText('STAR method compliance')).toBeInTheDocument()
  expect(screen.getByText('78%')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Key Strengths' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Knowledge Gaps' })).toBeInTheDocument()
  const gap = screen.getByText('Race conditions & atomics').closest('div')
  expect(within(gap).getByText('High')).toBeInTheDocument()
})

test('lists six questions with toned score badges', async () => {
  await openReport()
  expect(headers()).toHaveLength(6)
  expect(screen.getByText('66 / 100').className).toContain('text-amber-400')
  expect(screen.getByText('90 / 100').className).toContain('text-emerald-400')
})

test('Q4 is open initially and shows the reference answer and flashcard button', async () => {
  await openReport()
  expect(openOnes()).toHaveLength(1)
  expect(openOnes()[0]).toHaveTextContent(/^Q4/)
  expect(screen.getByText('Optimal Reference Answer')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add to Mistake Flashcards' })).toBeInTheDocument()
})

test('only one question is open at a time and the open one can be closed', async () => {
  const user = await openReport()
  await user.click(headers()[1])
  expect(openOnes()).toHaveLength(1)
  expect(openOnes()[0]).toHaveTextContent(/^Q2/)

  await user.click(headers()[1])
  expect(openOnes()).toHaveLength(0)
  expect(screen.queryByText('Optimal Reference Answer')).not.toBeInTheDocument()
})
