import { CornerDownLeft } from 'lucide-react'
import Badge from '@/components/common/Badge'
import Caption from '@/components/common/Caption'
import Card from '@/components/common/Card'
import Chip from './Chip'

export default function QuestionCard({ number, followUp, question }) {
  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Caption>Question {number}</Caption>
        {followUp && (
          <Badge tone="s">
            <CornerDownLeft className="size-3" aria-hidden="true" />
            Follow-up Question
          </Badge>
        )}
      </div>
      <p className="m-0 text-pretty text-xl font-semibold leading-[1.45] tracking-tight text-slate-50">
        {question.parts.map((p, i) =>
          p.code ? (
            <span key={i} className="font-mono text-[17px] text-indigo-200">
              {p.t}
            </span>
          ) : (
            <span key={i}>{p.t}</span>
          ),
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {question.chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>
    </Card>
  )
}
