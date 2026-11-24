import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createFlashcard } from '@/api/flashcards'
import { pronunciationCard } from '@/utils/speaking'
import GradingPanel from './GradingPanel'

vi.mock('@/api/flashcards', () => ({ createFlashcard: vi.fn() }))

const TRANSCRIPT = 'Yesterday I, um, fixed the issue. The tests is passing, um, and I deployed it.'
const at = (word, from = 0) => {
  const start = TRANSCRIPT.indexOf(word, from)
  return { start, end: start + word.length }
}

const RESULT = {
  id: 's1',
  prompt_text: 'Give your daily standup update.',
  transcript: TRANSCRIPT,
  duration_seconds: 84,
  words_per_minute: 129,
  overall_band: 6.5,
  band_delta: 0.5,
  summary: 'Clear update and a steady pace.',
  criteria: {
    fluency: { score: 7.0, feedback: 'Steady pace.' },
    pronunciation: { score: 6.0, feedback: 'Word stress slips.' },
    vocabulary: { score: 6.5, feedback: 'Clear technical words.' },
    grammar: { score: 5.5, feedback: 'Agreement slips.' },
  },
  marks: [
    { kind: 'filler', text: 'um', ...at('um'), respelling: null, note: null },
    { kind: 'pronunciation', text: 'issue', ...at('issue'), respelling: 'ISH-oo', note: 'One clear sh sound.' },
    { kind: 'filler', text: 'Um', ...at('um', 40), respelling: null, note: null },
    { kind: 'pronunciation', text: 'deployed', ...at('deployed'), respelling: 'dih-PLOYD', note: 'Short final d.' },
  ],
  grammar_corrections: [{ original: 'the tests is', corrected: 'the tests are', explanation: 'Tests is plural.' }],
  vocabulary_upgrades: [{ used: 'do a report', better: 'write up a report', explanation: 'Sounds natural.' }],
  filler_count: 2,
  created_at: '2026-11-24T10:00:00Z',
}

beforeEach(() => {
  createFlashcard.mockReset()
  createFlashcard.mockResolvedValue({ id: 'f1' })
})

describe('GradingPanel states', () => {
  it('explains what will appear when empty', () => {
    render(<GradingPanel phase="empty" />)
    expect(screen.getByText('Your feedback will appear here')).toBeInTheDocument()
    expect(screen.getByText(/four band scores, your speaking rate/)).toBeInTheDocument()
  })

  it('shows a busy skeleton while grading', () => {
    render(<GradingPanel phase="grading" />)
    expect(screen.getByLabelText('Grading your recording')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Grading your recording.')
    expect(screen.queryByText('BAND')).not.toBeInTheDocument()
  })
})

describe('GradingPanel result', () => {
  it('announces the result and shows the band, summary and change', () => {
    render(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.getByRole('status')).toHaveTextContent('Result ready: overall band 6.5.')
    expect(screen.getByLabelText('Overall band 6.5')).toBeInTheDocument()
    expect(screen.getByText('Clear update and a steady pace.')).toBeInTheDocument()
    expect(screen.getByText('+0.5 vs your last recording')).toBeInTheDocument()
  })

  it('colours the band tile by band', () => {
    const { rerender } = render(<GradingPanel phase="result" result={{ ...RESULT, overall_band: 7.5 }} />)
    expect(screen.getByLabelText('Overall band 7.5').className).toContain('emerald')
    rerender(<GradingPanel phase="result" result={{ ...RESULT, overall_band: 5.5 }} />)
    expect(screen.getByLabelText('Overall band 5.5').className).toContain('rose')
    rerender(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.getByLabelText('Overall band 6.5').className).toContain('amber')
  })

  it('shows the four criteria with band and feedback', () => {
    render(<GradingPanel phase="result" result={RESULT} />)
    const list = screen.getByRole('list', { name: 'Criteria scores' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items.map((li) => li.textContent)).toEqual([
      'Fluency7.0Steady pace.',
      'Pronunciation6.0Word stress slips.',
      'Vocabulary6.5Clear technical words.',
      'Grammar5.5Agreement slips.',
    ])
  })

  it('shows speaking rate with verdict, fillers and duration', () => {
    render(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.getByText('129 words/min')).toBeInTheDocument()
    expect(screen.getByText('in range')).toBeInTheDocument()
    expect(screen.getByText('2 fillers')).toBeInTheDocument()
    expect(screen.getByText('1:24')).toBeInTheDocument()
  })

  it('flags a slow rate and a single filler', () => {
    render(<GradingPanel phase="result" result={{ ...RESULT, words_per_minute: 90, filler_count: 1 }} />)
    expect(screen.getByText('a bit slow')).toBeInTheDocument()
    expect(screen.getByText('1 filler')).toBeInTheDocument()
  })

  it('labels a previous result', () => {
    const { rerender } = render(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.queryByText('Previous result')).not.toBeInTheDocument()
    rerender(<GradingPanel phase="result" result={RESULT} isPrevious />)
    expect(screen.getByText('Previous result')).toBeInTheDocument()
  })

  it('shows the first recording note when there is no previous band', () => {
    render(<GradingPanel phase="result" result={{ ...RESULT, band_delta: null }} />)
    expect(screen.getByText('First recording')).toBeInTheDocument()
  })
})

describe('GradingPanel transcript tab', () => {
  it('renders marks as labelled buttons with a legend', () => {
    render(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Filler: um' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pronunciation: deployed' })).toBeInTheDocument()
    expect(screen.getByText('Mispronounced')).toBeInTheDocument()
    expect(screen.getByText('Filler word')).toBeInTheDocument()
  })

  it('selects the first pronunciation mark at the start', () => {
    render(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.getByRole('button', { name: 'Pronunciation: issue' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Filler: um' })).toHaveAttribute('aria-pressed', 'false')
    const region = screen.getByRole('region', { name: 'Mark details' })
    expect(within(region).getByText('ISH-oo')).toBeInTheDocument()
    expect(within(region).getByText('One clear sh sound.')).toBeInTheDocument()
  })

  it('selects the first filler when there is no pronunciation mark', () => {
    const marks = RESULT.marks.filter((m) => m.kind === 'filler')
    render(<GradingPanel phase="result" result={{ ...RESULT, marks }} />)
    expect(screen.getByRole('button', { name: 'Filler: um' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows how often a filler was used, ignoring case', async () => {
    const user = userEvent.setup()
    render(<GradingPanel phase="result" result={RESULT} />)
    await user.click(screen.getByRole('button', { name: 'Filler: um' }))
    const region = screen.getByRole('region', { name: 'Mark details' })
    expect(within(region).getByText('Used 2 times')).toBeInTheDocument()
    expect(
      within(region).getByText('Pause silently instead. A short pause sounds more confident than a filler.'),
    ).toBeInTheDocument()
    expect(within(region).queryByRole('button', { name: /Save to Flashcards/ })).not.toBeInTheDocument()
  })

  it('says "Used once" for a single filler', async () => {
    const user = userEvent.setup()
    const marks = [RESULT.marks[0], RESULT.marks[1]]
    render(<GradingPanel phase="result" result={{ ...RESULT, marks }} />)
    await user.click(screen.getByRole('button', { name: 'Filler: um' }))
    expect(screen.getByText('Used once')).toBeInTheDocument()
  })

  it('shows the respelling of a clicked pronunciation mark', async () => {
    const user = userEvent.setup()
    render(<GradingPanel phase="result" result={RESULT} />)
    await user.click(screen.getByRole('button', { name: 'Pronunciation: deployed' }))
    expect(screen.getByText('dih-PLOYD')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pronunciation: issue' }))
    expect(screen.getByText('ISH-oo')).toBeInTheDocument()
  })

  it('saves the selected pronunciation card and shows it saved', async () => {
    const user = userEvent.setup()
    render(<GradingPanel phase="result" result={RESULT} />)
    const region = screen.getByRole('region', { name: 'Mark details' })
    await user.click(within(region).getByRole('button', { name: '+ Save to Flashcards' }))
    expect(createFlashcard).toHaveBeenCalledWith(pronunciationCard(RESULT.marks[1]))
    expect(await within(region).findByRole('button', { name: 'Saved to Flashcards' })).toBeDisabled()
  })
})

describe('GradingPanel mistakes tab', () => {
  async function openMistakes() {
    const user = userEvent.setup()
    render(<GradingPanel phase="result" result={RESULT} />)
    await user.click(screen.getByRole('tab', { name: /Mistakes/ }))
    return user
  }

  it('counts grammar, pronunciation and vocabulary items on the tab', () => {
    render(<GradingPanel phase="result" result={RESULT} />)
    expect(screen.getByRole('tab', { name: 'Mistakes 4' })).toBeInTheDocument()
  })

  it('lists all three kinds without fillers', async () => {
    await openMistakes()
    expect(screen.getByRole('tab', { name: /Mistakes/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('the tests is')).toBeInTheDocument()
    expect(screen.getByText('the tests are')).toBeInTheDocument()
    expect(screen.getByText('Tests is plural.')).toBeInTheDocument()
    expect(screen.getByText('issue')).toBeInTheDocument()
    expect(screen.getByText('ISH-oo')).toBeInTheDocument()
    expect(screen.getByText('do a report')).toBeInTheDocument()
    expect(screen.getByText('write up a report')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '+ Save to Flashcards' })).toHaveLength(4)
  })

  it('saves a pronunciation row with the pronunciation card', async () => {
    const user = await openMistakes()
    const row = screen.getByText('ISH-oo').closest('li')
    await user.click(within(row).getByRole('button', { name: '+ Save to Flashcards' }))
    expect(createFlashcard).toHaveBeenCalledWith(pronunciationCard(RESULT.marks[1]))
    expect(await within(row).findByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
  })

  it('saves grammar and vocabulary rows with their cards', async () => {
    const user = await openMistakes()
    await user.click(within(screen.getByText('the tests is').closest('li')).getByRole('button', { name: /Save/ }))
    expect(createFlashcard).toHaveBeenLastCalledWith({
      source_type: 'GRAMMAR_ERROR',
      front_content: 'the tests is',
      back_content: 'the tests are',
      explanation: 'Tests is plural.',
    })
    await user.click(within(screen.getByText('do a report').closest('li')).getByRole('button', { name: /Save/ }))
    expect(createFlashcard).toHaveBeenLastCalledWith({
      source_type: 'VOCABULARY',
      front_content: 'do a report',
      back_content: 'write up a report',
      explanation: 'Sounds natural.',
    })
  })

  it('shows an error when saving fails and lets the user retry', async () => {
    createFlashcard.mockRejectedValueOnce(new Error('boom'))
    const user = await openMistakes()
    const row = screen.getByText('the tests is').closest('li')
    await user.click(within(row).getByRole('button', { name: '+ Save to Flashcards' }))
    expect(await within(row).findByText('Could not save this card.')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Try again' }))
    expect(await within(row).findByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
    expect(createFlashcard).toHaveBeenCalledTimes(2)
  })

  it('keeps a saved state when switching back to the transcript tab', async () => {
    const user = await openMistakes()
    const row = screen.getByText('ISH-oo').closest('li')
    await user.click(within(row).getByRole('button', { name: '+ Save to Flashcards' }))
    await within(row).findByRole('button', { name: 'Saved to Flashcards' })
    await user.click(screen.getByRole('tab', { name: 'Transcript' }))
    expect(screen.getByRole('button', { name: 'Saved to Flashcards' })).toBeInTheDocument()
  })
})
