import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/routes'
import Sidebar from './Sidebar'

function renderSidebarAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar collapsed={false} />
    </MemoryRouter>,
  )
}

test('lists the five destinations in order', () => {
  renderSidebarAt('/')
  const nav = screen.getByRole('navigation', { name: 'Primary' })
  const names = within(nav)
    .getAllByRole('link')
    .map((a) => a.textContent)
  expect(names).toEqual([
    'Dashboard',
    'Tech Mock Interview',
    'English Writing & Speaking',
    'Mistake Flashcards',
    'CV & JD Profile',
  ])
})

test('marks Dashboard as current at / and nothing else', () => {
  renderSidebarAt('/')
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Tech Mock Interview' })).not.toHaveAttribute('aria-current')
})

test('keeps Tech Mock Interview current on a nested path and Dashboard not current', () => {
  renderSidebarAt('/interview/123')
  expect(screen.getByRole('link', { name: 'Tech Mock Interview' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
})

test('shows the sidebar together with the not-found page on an unknown URL', () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nope'] })
  render(<RouterProvider router={router} />)
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
})
