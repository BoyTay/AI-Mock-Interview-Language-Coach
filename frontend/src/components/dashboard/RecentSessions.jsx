import Badge from '@/components/common/Badge'
import Card from '@/components/common/Card'
import { cn } from '@/lib/utils'

const DOT = { t: 'bg-indigo-400', e: 'bg-sky-400', s: 'bg-violet-400' }
const TH =
  'border-y border-slate-800 bg-[#0b1224] px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[.08em] text-slate-400'

export default function RecentSessions({ rows }) {
  return (
    <Card aria-label="Recent practice sessions" className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-0.5 p-5">
        <h2 className="text-base font-semibold text-slate-50">Recent Practice Sessions</h2>
        <span className="text-[13px] text-slate-400">Your last six sessions across both modes</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={cn(TH, 'text-left')}>Session type</th>
              <th scope="col" className={cn(TH, 'text-left')}>Topic / Role</th>
              <th scope="col" className={cn(TH, 'text-left')}>Score</th>
              <th scope="col" className={cn(TH, 'text-left')}>Date</th>
              <th scope="col" className={cn(TH, 'text-right')}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-[#111c33]">
                <td className="border-b border-slate-800 px-5 py-3.5">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-xs font-medium text-slate-300">
                    <i className={cn('block size-2 rounded-full', DOT[r.typeKey])} />
                    {r.type}
                  </span>
                </td>
                <td className="border-b border-slate-800 px-5 py-3.5 text-slate-200">{r.topic}</td>
                <td className="border-b border-slate-800 px-5 py-3.5">
                  <Badge tone={r.tone}>{r.score}</Badge>
                </td>
                <td className="whitespace-nowrap border-b border-slate-800 px-5 py-3.5 font-mono text-[13px] text-slate-400">
                  {r.date}
                </td>
                <td className="border-b border-slate-800 px-5 py-3.5 text-right">
                  <button
                    type="button"
                    className="h-9 whitespace-nowrap rounded-lg border border-slate-700 px-3.5 text-[13px] font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                  >
                    View Feedback
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
