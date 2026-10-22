import { Bell, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const iconButton = 'size-10 border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'

export default function Header({ collapsed, onToggleSidebar }) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-8 py-3.5">
      <Button
        variant="outline"
        size="icon"
        className={iconButton}
        aria-label="Collapse or expand sidebar"
        aria-expanded={!collapsed}
        onClick={onToggleSidebar}
      >
        <PanelLeft className="size-[18px]" aria-hidden="true" />
      </Button>
      <div className="flex-1" />
      <Button variant="outline" size="icon" className={iconButton} aria-label="Notifications">
        <Bell className="size-[18px]" aria-hidden="true" />
      </Button>
      <div
        className="flex size-10 items-center justify-center rounded-full bg-indigo-900 text-[13px] font-semibold text-indigo-100"
        aria-label="Account: BoyTay"
      >
        BT
      </div>
    </header>
  )
}
