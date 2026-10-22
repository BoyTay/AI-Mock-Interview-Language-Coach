import { render, screen } from '@testing-library/react'
import StreakWidget from './StreakWidget'

const week = [true, true, true, true, true, true, false]

test('shows the day count, the hint and six filled bars out of seven', () => {
  const { container } = render(<StreakWidget days={14} week={week} collapsed={false} />)
  expect(screen.getByText('14 Day Streak')).toBeInTheDocument()
  expect(screen.getByText('Practice today to extend it')).toBeInTheDocument()
  expect(container.querySelectorAll('[data-filled]')).toHaveLength(7)
  expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(6)
})

test('collapsed shows only the number', () => {
  render(<StreakWidget days={14} week={week} collapsed />)
  expect(screen.queryByText(/Day Streak/)).not.toBeInTheDocument()
  expect(screen.getByText('14')).toBeInTheDocument()
})
