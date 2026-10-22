import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/routes'
import ModeSwitch from './ModeSwitch'

test('English Coach is pressed on /english and Tech Interview is not', () => {
  render(
    <MemoryRouter initialEntries={['/english']}>
      <ModeSwitch />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'English Coach' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Tech Interview' })).toHaveAttribute('aria-pressed', 'false')
})

test('Tech Interview is pressed on any other path', () => {
  render(
    <MemoryRouter initialEntries={['/flashcards']}>
      <ModeSwitch />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Tech Interview' })).toHaveAttribute('aria-pressed', 'true')
})

test('clicking English Coach navigates to the English page', async () => {
  const user = userEvent.setup()
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
  await user.click(screen.getByRole('button', { name: 'English Coach' }))
  expect(screen.getByRole('heading', { level: 1, name: 'English Writing Coach' })).toBeInTheDocument()
})
