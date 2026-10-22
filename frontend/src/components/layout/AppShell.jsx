import { Outlet } from 'react-router-dom'

// Stub: the sidebar and header arrive in the next tasks.
export default function AppShell() {
  return (
    <main className="p-8">
      <Outlet />
    </main>
  )
}
