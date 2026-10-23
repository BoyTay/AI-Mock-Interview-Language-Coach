const TONE_STROKE = { g: '#10b981', a: '#f59e0b', r: '#f43f5e' }
const RADIUS = 58

export default function ScoreRing({ value, max = 100, size = 140, tone = 'g', label }) {
  const circumference = 2 * Math.PI * RADIUS
  const arc = circumference * Math.min(Math.max(value / max, 0), 1)

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={label ?? `${value} out of ${max}`}>
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden="true">
        <span className="font-mono text-[38px] font-semibold tracking-[-0.04em] text-slate-50">{value}</span>
        <span className="mt-1 font-mono text-xs text-slate-400">/ {max}</span>
      </div>
    </div>
  )
}
