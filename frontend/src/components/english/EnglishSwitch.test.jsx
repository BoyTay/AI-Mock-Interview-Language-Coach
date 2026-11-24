import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/routes'
import EnglishSwitch from './EnglishSwitch'

vi.mock('@/api/interview', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProfile: vi.fn().mockResolvedValue({ target_role: 'Dev', has_cv: true }),
}))

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

function renderSwitchAt(path) {
  const router = createMemoryRouter([{ path: '*', element: <EnglishSwitch /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

const switchNav = () => screen.getByRole('navigation', { name: 'English practice' })

test('the switch links to the Writing and Speaking routes', () => {
  renderSwitchAt('/english/writing')
  expect(switchNav()).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Writing' })).toHaveAttribute('href', '/english/writing')
  expect(screen.getByRole('link', { name: 'Speaking' })).toHaveAttribute('href', '/english/speaking')
})

test('at /english/speaking the Speaking link is current and Writing is not', () => {
  renderSwitchAt('/english/speaking')
  expect(screen.getByRole('link', { name: 'Speaking' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Writing' })).not.toHaveAttribute('aria-current')
})

test('at /english/writing the Writing link is current and Speaking is not', () => {
  renderSwitchAt('/english/writing')
  expect(screen.getByRole('link', { name: 'Writing' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Speaking' })).not.toHaveAttribute('aria-current')
})

test.each(['/english/writing', '/english/speaking'])(
  'the sidebar item "English Writing & Speaking" is active at %s',
  (path) => {
    renderAt(path)
    expect(screen.getByRole('link', { name: 'English Writing & Speaking' })).toHaveAttribute('aria-current', 'page')
  },
)

test('the Writing page shows the switch with Writing current', () => {
  renderAt('/english/writing')
  expect(within(switchNav()).getByRole('link', { name: 'Writing' })).toHaveAttribute('aria-current', 'page')
})
