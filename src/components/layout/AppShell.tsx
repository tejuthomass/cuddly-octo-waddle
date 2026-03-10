import { Outlet } from 'react-router-dom'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/hooks/useAuth'

export function AppShell() {
  const { activeContext } = useAuth()

  if (!activeContext) {
    return null
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        <Sidebar role={activeContext.role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Breadcrumbs />
          <div className="flex-1 overflow-y-auto">
          <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
