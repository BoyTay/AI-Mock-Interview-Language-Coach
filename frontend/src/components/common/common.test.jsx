import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Accordion from './Accordion'
import Badge from './Badge'
import ProgressSegments from './ProgressSegments'
import ScoreRing from './ScoreRing'

test('Badge applies the tone classes', () => {
  render(<Badge tone="g">OK</Badge>)
  expect(screen.getByText('OK').className).toContain('text-emerald-400')
})

test('ScoreRing exposes its value as an image with a label', () => {
  render(<ScoreRing value={82} />)
  expect(screen.getByRole('img', { name: '82 out of 100' })).toBeInTheDocument()
})

test('ProgressSegments marks answered, current and remaining segments', () => {
  const { container } = render(<ProgressSegments total={6} answered={2} label="Progress" />)
  const bars = container.querySelector('[aria-label="Progress"]').children
  expect(bars).toHaveLength(6)
  expect(container.querySelectorAll('.bg-indigo-600')).toHaveLength(2)
  expect(container.querySelectorAll('.bg-indigo-300')).toHaveLength(1)
  expect(container.querySelectorAll('.bg-slate-700')).toHaveLength(3)
})

test('Accordion hides its panel when closed and shows it when open', async () => {
  const onToggle = vi.fn()
  const { rerender } = render(
    <Accordion id="a" open={false} onToggle={onToggle} header="Head">
      Body
    </Accordion>,
  )
  const button = screen.getByRole('button', { name: /Head/ })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Body')).not.toBeInTheDocument()

  await userEvent.click(button)
  expect(onToggle).toHaveBeenCalledTimes(1)

  rerender(
    <Accordion id="a" open onToggle={onToggle} header="Head">
      Body
    </Accordion>,
  )
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Body')).toBeInTheDocument()
})
