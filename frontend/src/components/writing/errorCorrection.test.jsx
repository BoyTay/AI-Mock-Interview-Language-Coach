import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorCorrection from './ErrorCorrection'
import FeedbackTabs from './FeedbackTabs'

const mistake = (id, w, f, extra = {}) => ({ id, w, f, k: 'Grammar', title: `Title ${id}`, why: `Why ${id}`, ...extra })

test('an essay with no mistakes shows a clean state instead of crashing', () => {
  render(<ErrorCorrection segments={['A perfectly fine essay.', null, 'Second paragraph.']} />)
  expect(screen.getByText('No mistakes found')).toBeInTheDocument()
  expect(screen.getByText(/A perfectly fine essay\./)).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Mistake explanation' })).not.toBeInTheDocument()
})

test('a highlighted sentence strikes only the wrong words and marks only the fix', () => {
  const segments = ['Start. ', mistake(1, 'Yesterday I fix the bug.', 'Yesterday I fixed the bug.'), ' End.']
  render(<ErrorCorrection segments={segments} />)

  const button = within(screen.getByRole('group', { name: 'Essay with highlighted mistakes' })).getByRole('button')
  expect([...button.querySelectorAll('s')].map((el) => el.textContent)).toEqual(['fix'])
  expect([...button.querySelectorAll('b')].map((el) => el.textContent)).toEqual(['fixed'])
  expect(button).toHaveTextContent('Yesterday I fix fixed the bug.')
})

test('the explanation panel shows the type, title, change and explanation', () => {
  const segments = [mistake(1, 'more easy', 'easier', { k: 'Vocabulary', title: 'Comparative form', why: 'Use -er.' })]
  render(<ErrorCorrection segments={segments} />)

  const panel = within(screen.getByRole('region', { name: 'Mistake explanation' }))
  expect(panel.getByText('Vocabulary')).toBeInTheDocument()
  expect(panel.getByText('Comparative form')).toBeInTheDocument()
  expect(panel.getByText('Use -er.')).toBeInTheDocument()
  expect(panel.getByRole('button', { name: '+ Save to Flashcards' })).toBeInTheDocument()
})

test('mistakes not found in the text are listed below instead of being dropped', async () => {
  const user = userEvent.setup()
  const segments = ['Some text ', mistake(1, 'bad', 'good'), '.']
  const unplaced = [mistake(2, 'He go home.', 'He goes home.', { title: 'Subject-verb', why: 'Add -es.' })]
  render(<ErrorCorrection segments={segments} unplaced={unplaced} />)

  const list = screen.getByRole('list', { name: 'Mistakes not found in your text' })
  const item = within(list).getByRole('button')
  expect(item).toHaveTextContent('He go goes home.')

  await user.click(item)
  expect(item).toHaveAttribute('aria-pressed', 'true')
  const panel = within(screen.getByRole('region', { name: 'Mistake explanation' }))
  expect(panel.getByText('Subject-verb')).toBeInTheDocument()
  expect(panel.getByText('Add -es.')).toBeInTheDocument()
})

test('only one mistake is selected across the text and the fallback list', async () => {
  const user = userEvent.setup()
  render(
    <ErrorCorrection segments={[mistake(1, 'bad', 'good')]} unplaced={[mistake(2, 'He go.', 'He goes.')]} />,
  )
  await user.click(within(screen.getByRole('list', { name: 'Mistakes not found in your text' })).getByRole('button'))

  const inText = within(screen.getByRole('group', { name: 'Essay with highlighted mistakes' })).getByRole('button')
  expect(inText).toHaveAttribute('aria-pressed', 'false')
})

test('when every mistake is unplaced, the list still shows and the clean state does not', () => {
  render(<ErrorCorrection segments={['Plain essay text.']} unplaced={[mistake(1, 'He go.', 'He goes.')]} />)

  expect(screen.queryByText('No mistakes found')).not.toBeInTheDocument()
  expect(screen.getByText('Plain essay text.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Mistake explanation' })).toHaveTextContent('Why 1')
})

test('the tab badge counts mistakes in the text and in the fallback list', () => {
  render(
    <FeedbackTabs
      segments={[mistake(1, 'bad', 'good')]}
      unplaced={[mistake(2, 'x', 'y'), mistake(3, 'p', 'q')]}
      vocab={[]}
    />,
  )
  expect(screen.getByRole('tab', { name: /Interactive Error Correction/ })).toHaveTextContent('3')
})
