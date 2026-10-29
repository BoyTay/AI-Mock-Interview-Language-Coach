import { render, screen } from '@testing-library/react'
import BandSummary from './BandSummary'
import GradingPlaceholder from './GradingPlaceholder'
import VocabularyUpgrader from './VocabularyUpgrader'

const criteria = [
  { name: 'Task Response', band: 7, feedback: 'Addresses every part of the task.' },
  { name: 'Lexical Resource', band: 5.5, feedback: 'Repeats basic words.' },
]

test('shows the feedback for each criterion under its bar', () => {
  render(<BandSummary overall={{ band: 6.5, delta: '+0.5 vs your previous essay' }} criteria={criteria} />)
  expect(screen.getByText('Addresses every part of the task.')).toBeInTheDocument()
  expect(screen.getByText('Repeats basic words.')).toBeInTheDocument()
  expect(screen.getByText('+0.5 vs your previous essay')).toBeInTheDocument()
})

test('colors a band below 6 rose', () => {
  render(<BandSummary overall={{ band: 6.5, delta: 'x' }} criteria={criteria} />)
  const item = screen.getByText('Lexical Resource').closest('li')
  expect(item.querySelector('.bg-rose-500')).not.toBeNull()
})

test('does not claim a verdict that the AI never gave', () => {
  render(<BandSummary overall={{ band: 4, delta: 'x' }} criteria={criteria} />)
  expect(screen.queryByText(/Good command of ideas/)).not.toBeInTheDocument()
})

test('a vocabulary card without a C2 alternative shows only C1', () => {
  render(
    <VocabularyUpgrader
      vocab={[{ basic: 'good', c1: 'superb', example: 'A superb result.' }]}
      saved={{}}
      onToggleSave={() => {}}
    />,
  )
  expect(screen.getByText('superb')).toBeInTheDocument()
  expect(screen.getByText('C1')).toBeInTheDocument()
  expect(screen.queryByText('C2')).not.toBeInTheDocument()
})

test('the placeholder explains how to get a grade', () => {
  render(<GradingPlaceholder />)
  expect(screen.getByRole('status')).toHaveTextContent(/Evaluate with AI/)
})
