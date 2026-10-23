import { render, screen } from '@testing-library/react'
import ErrorCorrection from './ErrorCorrection'

test('an essay with no mistakes shows a clean state instead of crashing', () => {
  render(<ErrorCorrection segments={['A perfectly fine essay.', null, 'Second paragraph.']} />)
  expect(screen.getByText('No mistakes found')).toBeInTheDocument()
  expect(screen.getByText(/A perfectly fine essay\./)).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Mistake explanation' })).not.toBeInTheDocument()
})
