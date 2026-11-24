import { Mic, PenLine } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Writing', to: '/english/writing', icon: PenLine },
  { label: 'Speaking', to: '/english/speaking', icon: Mic },
]

export default function EnglishSwitch() {
  return (
    <nav
      aria-label="English practice"
      className="inline-flex gap-0.5 self-start rounded-[9px] border border-slate-800 bg-slate-900 p-[3px]"
    >
      {TABS.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex h-[34px] items-center gap-2 whitespace-nowrap rounded-md px-4 text-[13px] font-medium',
              isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200',
            )
          }
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
