import { useState } from 'react'
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

export default function FeedbackTabs({ segments, vocab }) {
  const [tab, setTab] = useState('errors')
  // Saved vocabulary lives here so it survives switching tabs.
  const [saved, setSaved] = useState({})
  const errorCount = segments.filter((s) => s && typeof s === 'object').length

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
          <ErrorCorrection segments={segments} />
        ) : (
          <VocabularyUpgrader
            vocab={vocab}
            saved={saved}
            onToggleSave={(i) => setSaved((s) => ({ ...s, [i]: true }))}
          />
        )}
      </div>
    </Card>
  )
}
