import { ArrowRight } from 'lucide-react'
import Badge from '@/components/common/Badge'
import { vocabCard } from '@/utils/cards'
import SaveButton from './SaveButton'

export default function VocabularyUpgrader({ vocab, saves, onSave }) {
  return (
    <div className="flex flex-col gap-3.5 p-5">
      <span className="text-[13px] text-slate-400">Basic words from your essay, mapped to C1/C2 academic alternatives.</span>
      {vocab.map((v, i) => (
        <div key={v.basic} className="flex flex-col gap-3.5 rounded-xl border border-slate-800 bg-slate-950 p-[18px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-slate-800 px-2.5 py-1 font-mono text-sm font-medium text-slate-300">{v.basic}</span>
            <ArrowRight className="size-4 text-slate-400" aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-base font-semibold text-emerald-400">{v.c1}</span>
              <Badge tone="i" className="h-[22px] text-[11px]">
                C1
              </Badge>
            </div>
            {v.c2 && (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-base font-semibold text-emerald-400">{v.c2}</span>
                <Badge tone="s" className="h-[22px] text-[11px]">
                  C2
                </Badge>
              </div>
            )}
          </div>
          <p className="m-0 text-[13px] leading-[1.6] text-slate-300">{v.example}</p>
          <SaveButton status={saves[`vocab:${i}`]} onClick={() => onSave(`vocab:${i}`, vocabCard(v))} />
        </div>
      ))}
    </div>
  )
}
