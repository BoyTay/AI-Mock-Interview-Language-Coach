import { useState } from 'react'
import { createFlashcard } from '@/api/flashcards'
import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'
import ErrorCorrection from './ErrorCorrection'
import VocabularyUpgrader from './VocabularyUpgrader'

const tabClass = (on) =>
  cn(
    'mr-5 flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm font-medium',
    on ? 'border-indigo-500 text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-200',
  )

export default function FeedbackTabs({ segments, unplaced = [], vocab }) {
  const [tab, setTab] = useState('errors')
  // Save progress lives here so it survives switching tabs. key -> 'saving' | 'saved' | 'error'
  const [saves, setSaves] = useState({})
  const setStatus = (key, status) => setSaves((s) => ({ ...s, [key]: status }))

  async function save(key, card) {
    if (saves[key] === 'saving' || saves[key] === 'saved') return
    setStatus(key, 'saving')
    try {
      await createFlashcard(card)
      setStatus(key, 'saved')
    } catch {
      setStatus(key, 'error')
    }
  }

  const errorCount = segments.filter((s) => s && typeof s === 'object').length + unplaced.length

  return (
    <Card className="overflow-hidden">
      <div role="tablist" aria-label="Feedback views" className="flex flex-wrap border-b border-slate-800 px-5">
        <button
          type="button"
          role="tab"
          id="tab-errors"
          aria-selected={tab === 'errors'}
          aria-controls="panel-feedback"
          onClick={() => setTab('errors')}
          className={tabClass(tab === 'errors')}
        >
          Interactive Error Correction
          <Badge tone="r" className="h-[22px] text-[11px]">
            {errorCount}
          </Badge>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-vocab"
          aria-selected={tab === 'vocab'}
          aria-controls="panel-feedback"
          onClick={() => setTab('vocab')}
          className={tabClass(tab === 'vocab')}
        >
          Vocabulary Upgrader
          <Badge tone="s" className="h-[22px] text-[11px]">
            {vocab.length}
          </Badge>
        </button>
      </div>
      <div role="tabpanel" id="panel-feedback" aria-labelledby={tab === 'errors' ? 'tab-errors' : 'tab-vocab'}>
        {tab === 'errors' ? (
          <ErrorCorrection segments={segments} unplaced={unplaced} saves={saves} onSave={save} />
        ) : (
          <VocabularyUpgrader vocab={vocab} saves={saves} onSave={save} />
        )}
      </div>
    </Card>
  )
}
