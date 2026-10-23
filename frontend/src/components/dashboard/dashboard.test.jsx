import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { recentSessions } from '@/mocks/dashboard'
import MetricCards from './MetricCards'
import RecentSessions from './RecentSessions'

function renderCards() {
  render(
    <MemoryRouter>
      <MetricCards />
    </MemoryRouter>,
  )
}

test('shows the four metric cards with their values', () => {
  renderCards()
  for (const title of ['Total Mock Sessions', 'Avg Technical Score', 'Estimated English Band', 'Due Flashcards Today']) {
    expect(screen.getByText(title)).toBeInTheDocument()
  }
  for (const value of ['48', '76', '6.5', '23']) {
    expect(screen.getByText(value)).toBeInTheDocument()
  }
  expect(screen.getByText('Target band 7.0')).toBeInTheDocument()
})

test('Start review links to the flashcards page', () => {
  renderCards()
  expect(screen.getByRole('link', { name: 'Start review →' })).toHaveAttribute('href', '/flashcards')
})

test('recent sessions table has the design columns and six rows', () => {
  render(<RecentSessions rows={recentSessions} />)
  for (const name of ['Session type', 'Topic / Role', 'Score', 'Date', 'Action']) {
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
  }
  const body = screen.getAllByRole('rowgroup')[1]
  expect(within(body).getAllByRole('row')).toHaveLength(6)
})

test('score badges use the tone of the score', () => {
  render(<RecentSessions rows={recentSessions} />)
  expect(screen.getByText('62 / 100').className).toContain('text-amber-400')
  expect(screen.getByText('84 / 100').className).toContain('text-emerald-400')
  expect(screen.getByText('Band 5.5').className).toContain('text-rose-400')
})
