import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-wrap bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-[999_1_560px] p-8">
        <Outlet />
      </main>
    </div>
  )
}
