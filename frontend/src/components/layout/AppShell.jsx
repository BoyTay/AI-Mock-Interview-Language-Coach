import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen flex-wrap bg-background text-foreground">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <Header collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
