import { Languages, SquareTerminal } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

const MODES = [
  { id: 'tech', label: 'Tech Interview', to: '/interview', icon: SquareTerminal },
  { id: 'english', label: 'English Coach', to: '/english', icon: Languages },
]

export default function ModeSwitch() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = pathname === '/english' || pathname.startsWith('/english/') ? 'english' : 'tech'

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[.08em] text-slate-400">Mode</span>
      <div className="flex gap-0.5 rounded-[9px] border border-slate-800 bg-slate-900 p-[3px]">
        {MODES.map(({ id, label, to, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={current === id}
            onClick={() => navigate(to)}
            className={cn(
              'flex h-[34px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium',
              current === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
