import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/hooks/useAuth'

export function AppShell() {
  const { activeContext } = useAuth()

  if (!activeContext) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <Sidebar role={activeContext.role} />
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
