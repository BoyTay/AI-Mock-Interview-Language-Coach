import { Code } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import ModeSwitch from './ModeSwitch'
import { NAV_ITEMS } from './navItems'
import StreakWidget from './StreakWidget'

// Mock values until the dashboard API exists (issue #34).
const STREAK_DAYS = 14
const STREAK_WEEK = [true, true, true, true, true, true, false]

export default function Sidebar({ collapsed }) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'flex max-w-full flex-none flex-col gap-5 border-r border-slate-800 bg-slate-950 p-4 transition-[width] duration-200 motion-reduce:transition-none',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <div className={cn('flex h-10 items-center gap-2.5', collapsed && 'justify-center')}>
        <div className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-indigo-600">
          <Code className="size-5 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-[1.1]">
            <span className="text-base font-bold tracking-tight text-slate-50">DevCoach AI</span>
            <span className="mt-[3px] font-mono text-[11px] text-slate-400">v1.0 · beta</span>
          </div>
        )}
      </div>

      {!collapsed && <ModeSwitch />}

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-indigo-600/[.18] text-indigo-200'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )
            }
          >
            <Icon className="size-[18px] flex-none" aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <StreakWidget days={STREAK_DAYS} week={STREAK_WEEK} collapsed={collapsed} />
      </div>
    </aside>
  )
}
