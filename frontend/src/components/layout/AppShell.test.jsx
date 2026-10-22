import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/routes'

function renderShell(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

const toggle = () => screen.getByRole('button', { name: 'Collapse or expand sidebar' })
const sidebar = () => screen.getByRole('complementary')

test('the toggle collapses and expands the sidebar', async () => {
  const user = userEvent.setup()
  renderShell()
  expect(sidebar()).toHaveAttribute('data-collapsed', 'false')
  expect(toggle()).toHaveAttribute('aria-expanded', 'true')

  await user.click(toggle())
  expect(sidebar()).toHaveAttribute('data-collapsed', 'true')
  expect(toggle()).toHaveAttribute('aria-expanded', 'false')

  await user.click(toggle())
  expect(sidebar()).toHaveAttribute('data-collapsed', 'false')
})

test('a collapsed sidebar shows no text labels but every link keeps its name', async () => {
  const user = userEvent.setup()
  renderShell()
  await user.click(toggle())
  expect(screen.queryByText('Mistake Flashcards')).not.toBeInTheDocument()
  for (const name of [
    'Dashboard',
    'Tech Mock Interview',
    'English Writing & Speaking',
    'Mistake Flashcards',
    'CV & JD Profile',
  ]) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument()
  }
})

test('the toggle works from the keyboard with Enter and Space', async () => {
  const user = userEvent.setup()
  renderShell()
  toggle().focus()
  await user.keyboard('{Enter}')
  expect(sidebar()).toHaveAttribute('data-collapsed', 'true')
  await user.keyboard(' ')
  expect(sidebar()).toHaveAttribute('data-collapsed', 'false')
})

test('the header has notifications and the account avatar', () => {
  renderShell()
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  expect(screen.getByLabelText('Account: BoyTay')).toHaveTextContent('BT')
})
