import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '@/components/common/Card'

const ALT =
  'Line chart of weekly scores. Technical interviews rose from 58 to 81 over eight weeks. English writing rose from 52 to 72.'
const AXIS = { fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }

export default function ScoreProgression({ tech, english }) {
  const data = tech.map((t, i) => ({ week: `W${i + 1}`, tech: t, english: english[i] }))

  return (
    <Card className="flex min-w-0 flex-[1.6_1_460px] flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-slate-50">Weekly score progression</h2>
          <span className="text-[13px] text-slate-400">Average score per week, last 8 weeks</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="block size-2.5 rounded-full bg-indigo-400" />
            Technical Interviews
          </span>
          <span className="flex items-center gap-1.5">
            <span className="block size-2.5 rounded-full bg-emerald-400" />
            English Writing
          </span>
        </div>
      </div>
      <div role="img" aria-label={ALT} className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 580, height: 240 }}>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="#1e293b" />
            <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: '#334155' }} />
            <YAxis domain={[40, 100]} ticks={[40, 60, 80, 100]} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Line
              type="linear"
              dataKey="english"
              name="English Writing"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="tech"
              name="Technical Interviews"
              stroke="#818cf8"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
