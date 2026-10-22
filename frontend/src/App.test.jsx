import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the dashboard at the root URL', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
})
