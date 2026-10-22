import { Code } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

export default function Sidebar() {
  return (
    <aside className="flex w-[264px] max-w-full flex-none flex-col gap-5 border-r border-slate-800 bg-slate-950 p-4">
      <div className="flex h-10 items-center gap-2.5">
        <div className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-indigo-600">
          <Code className="size-5 text-white" aria-hidden="true" />
        </div>
        <div className="flex flex-col leading-[1.1]">
          <span className="text-base font-bold tracking-tight text-slate-50">DevCoach AI</span>
          <span className="mt-[3px] font-mono text-[11px] text-slate-400">v1.0 · beta</span>
        </div>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                isActive
                  ? 'bg-indigo-600/[.18] text-indigo-200'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )
            }
          >
            <Icon className="size-[18px] flex-none" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
