import { NavLink } from 'react-router-dom'
import { ClipboardList, LayoutGrid, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 p-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2">
        <NavLink
          to="/technician"
          end
          className={({ isActive }) =>
            cn(
              'flex h-12 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-foreground',
            )
          }
        >
          <LayoutGrid className="h-4 w-4" />
          Home
        </NavLink>

        <NavLink
          to="/technician/assignments"
          className={({ isActive }) =>
            cn(
              'flex h-12 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-foreground',
            )
          }
        >
          <ListChecks className="h-4 w-4" />
          Tasks
        </NavLink>

        <NavLink
          to="/technician/inspections"
          className={({ isActive }) =>
            cn(
              'flex h-12 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-foreground',
            )
          }
        >
          <ClipboardList className="h-4 w-4" />
          Logs
        </NavLink>
      </div>
    </nav>
  )
}
