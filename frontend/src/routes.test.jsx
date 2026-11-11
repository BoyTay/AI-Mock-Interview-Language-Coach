import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from './routes'

vi.mock('@/api/interview', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProfile: vi.fn().mockResolvedValue({ target_role: 'Dev', has_cv: true }),
}))

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

test.each([
  ['/', 'Dashboard'],
  ['/interview', 'Set up your session'],
  ['/english', 'English Writing Coach'],
  ['/flashcards', 'Mistake Flashcards'],
  ['/profile', 'CV & JD Profile'],
])('%s renders the "%s" heading', (path, heading) => {
  renderAt(path)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})

test('an unknown URL renders the not-found page', () => {
  renderAt('/nope')
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
})
