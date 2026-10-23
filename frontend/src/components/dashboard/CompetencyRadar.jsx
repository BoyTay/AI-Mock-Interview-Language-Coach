import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import Card from '@/components/common/Card'

export default function CompetencyRadar({ labels, current, target }) {
  const data = labels.map((subject, i) => ({ subject, current: current[i], target }))
  const alt = `Radar chart. ${labels.map((l, i) => `${l} ${current[i]}`).join(', ')}, out of 100.`

  return (
    <Card className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-slate-50">Competency radar</h2>
        <span className="text-[13px] text-slate-400">Current level vs. target of {target}</span>
      </div>
      <div role="img" aria-label={alt} className="mx-auto h-[262px] w-full max-w-[420px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 380, height: 262 }}>
          <RadarChart data={data} outerRadius="68%">
            <PolarGrid gridType="polygon" stroke="#1e293b" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="target"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive={false}
            />
            <Radar
              dataKey="current"
              stroke="#818cf8"
              strokeWidth={2}
              fill="#6366f1"
              fillOpacity={0.28}
              dot={{ r: 3, fill: '#818cf8', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="block size-2.5 rounded-[3px] bg-indigo-400" />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-0 w-3.5 border-t-2 border-dashed border-slate-400" />
          Target ({target})
        </span>
      </div>
    </Card>
  )
}
