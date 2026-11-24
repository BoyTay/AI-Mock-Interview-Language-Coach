import { render, screen } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter, useRoutes } from 'react-router-dom'
import { routes } from './routes'

vi.mock('@/api/interview', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProfile: vi.fn().mockResolvedValue({ target_role: 'Dev', has_cv: true }),
}))

vi.mock('@/api/writing', async (importOriginal) => ({
  ...(await importOriginal()),
  // Never settles: these tests check routing, not the prompt, and a late reply would update state outside act().
  fetchPrompt: vi.fn(() => new Promise(() => {})),
}))
vi.mock('@/api/speaking', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchSpeakingPrompt: vi.fn(() => new Promise(() => {})),
}))

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

test.each([
  ['/', 'Dashboard'],
  ['/interview', 'Set up your session'],
  ['/english/writing', 'English Writing Coach'],
  ['/english/speaking', 'English Speaking Coach'],
  ['/flashcards', 'Mistake Flashcards'],
  ['/profile', 'CV & JD Profile'],
])('%s renders the "%s" heading', (path, heading) => {
  renderAt(path)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})

function AppRoutes() {
  return useRoutes(routes)
}

// A data router redirect runs through fetch, which fails under jsdom here, so the redirect
// is checked with a plain MemoryRouter that reads the same route table.
test('/english redirects to the Writing page', () => {
  render(
    <MemoryRouter initialEntries={['/english']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'English Writing Coach' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Writing' })).toHaveAttribute('aria-current', 'page')
})

test('an unknown URL renders the not-found page', () => {
  renderAt('/nope')
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
})
