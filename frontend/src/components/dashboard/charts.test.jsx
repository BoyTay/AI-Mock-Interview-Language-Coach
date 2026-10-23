import { render, screen } from '@testing-library/react'
import { radar, weekly } from '@/mocks/dashboard'
import CompetencyRadar from './CompetencyRadar'
import ScoreProgression from './ScoreProgression'

test('radar chart renders with a text alternative and legend', () => {
  render(<CompetencyRadar labels={radar.labels} current={radar.current} target={radar.target} />)
  expect(screen.getByRole('heading', { name: 'Competency radar' })).toBeInTheDocument()
  expect(
    screen.getByRole('img', {
      name: 'Radar chart. Backend Architecture 72, Database and SQL 85, Problem Solving 68, English Fluency 74, Grammar and Vocab 62, out of 100.',
    }),
  ).toBeInTheDocument()
  expect(screen.getByText('Current')).toBeInTheDocument()
  expect(screen.getByText('Target (80)')).toBeInTheDocument()
})

test('line chart renders with a text alternative and legend', () => {
  render(<ScoreProgression tech={weekly.tech} english={weekly.english} />)
  expect(screen.getByRole('heading', { name: 'Weekly score progression' })).toBeInTheDocument()
  expect(
    screen.getByRole('img', {
      name: 'Line chart of weekly scores. Technical interviews rose from 58 to 81 over eight weeks. English writing rose from 52 to 72.',
    }),
  ).toBeInTheDocument()
  expect(screen.getByText('Technical Interviews')).toBeInTheDocument()
  expect(screen.getByText('English Writing')).toBeInTheDocument()
})
