import { Lightbulb } from 'lucide-react'
import { useState } from 'react'
import Accordion from '@/components/common/Accordion'
import Card from '@/components/common/Card'
import Chip from './Chip'

export default function HintAccordion({ concepts }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="overflow-hidden">
      <Accordion
        id="hint"
        open={open}
        onToggle={() => setOpen((o) => !o)}
        header={
          <>
            <span className="flex size-[30px] flex-none items-center justify-center rounded-lg bg-amber-500/[.14]">
              <Lightbulb className="size-4 text-amber-400" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {open ? 'Hide Hint / Key Concepts' : 'Show Hint / Key Concepts'}
            </span>
          </>
        }
      >
        <div className="flex flex-col gap-3 px-5 pb-[18px]">
          <span className="pt-3.5 text-[13px] text-slate-400">Concepts a strong answer touches on:</span>
          <div className="flex flex-wrap gap-2">
            {concepts.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </div>
      </Accordion>
    </Card>
  )
}
