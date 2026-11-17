import { render } from '@testing-library/react'
import Waveform from './Waveform'

const heights = (container) => [...container.querySelectorAll('i')].map((bar) => bar.style.height)

test('without a level it stays the decorative animated waveform', () => {
  const { container } = render(<Waveform bars={4} />)

  expect(container.querySelectorAll('i')).toHaveLength(4)
  expect(container.querySelector('i').className).toMatch(/animate-/)
})

test('with a level it is flat in silence and not animated by css', () => {
  const { container } = render(<Waveform bars={4} level={0} />)

  expect(heights(container)).toEqual(['8%', '8%', '8%', '8%'])
  expect(container.querySelector('i').className).not.toMatch(/animate-/)
})

test('a loud voice fills the newest bar and earlier levels scroll to the left', () => {
  const { container, rerender } = render(<Waveform bars={4} level={0} />)

  rerender(<Waveform bars={4} level={0.5} />)
  expect(heights(container)).toEqual(['8%', '8%', '8%', '100%'])

  rerender(<Waveform bars={4} level={0.1} />)
  expect(heights(container)).toEqual(['8%', '8%', '100%', '35.6%'])
})

test('stays hidden from screen readers', () => {
  const { container } = render(<Waveform bars={4} level={0.2} />)

  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
})
