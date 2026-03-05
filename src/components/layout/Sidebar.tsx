import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/types/database'

interface SidebarProps {
  role: AppRole
}

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

function navItemsByRole(role: AppRole): NavItem[] {
  const defaultDashboard: Record<AppRole, string> = {
    l1_technician: '/technician',
    l2_supervisor: '/supervisor',
    l3_manager: '/manager',
    l4_management: '/management',
    l5_admin: '/admin',
    client_viewer: '/client',
  }

  if (role === 'l5_admin') {
    return [
      {
        label: 'Dashboard',
        to: '/admin',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'Users',
        to: '/admin/users',
        icon: Users,
      },
      {
        label: 'Clients',
        to: '/admin/clients',
        icon: Building2,
      },
      {
        label: 'Logs',
        to: '/admin/logs',
        icon: ClipboardList,
      },
    ]
  }

  if (role === 'l3_manager') {
    return [
      {
        label: 'Dashboard',
        to: '/manager',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'Assets',
        to: '/manager/assets',
        icon: Wrench,
      },
      {
        label: 'Forms',
        to: '/manager/templates',
        icon: ClipboardList,
      },
    ]
  }

  if (role === 'l2_supervisor') {
    return [
      {
        label: 'Dashboard',
        to: '/supervisor',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'Reviews',
        to: '/supervisor/reviews',
        icon: ClipboardCheck,
      },
      {
        label: 'Tickets',
        to: '/supervisor/tickets',
        icon: Activity,
      },
    ]
  }

  if (role === 'l4_management') {
    return [
      {
        label: 'Dashboard',
        to: '/management',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'KPIs',
        to: '/management/overview',
        icon: BarChart3,
      },
      {
        label: 'Abnormalities',
        to: '/management/abnormalities',
        icon: Gauge,
      },
    ]
  }

  if (role === 'client_viewer') {
    return [
      {
        label: 'Dashboard',
        to: '/client',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'Overview',
        to: '/client/overview',
        icon: BarChart3,
      },
      {
        label: 'History',
        to: '/client/history',
        icon: ClipboardList,
      },
    ]
  }

  return [
    {
      label: 'Dashboard',
      to: defaultDashboard[role],
      icon: ShieldCheck,
      end: true,
    },
  ]
}

export function Sidebar({ role }: SidebarProps) {
  const navItems = navItemsByRole(role)

  return (
    <aside className="hidden h-full w-64 overflow-y-auto border-r border-border/70 bg-card/60 px-4 py-6 lg:block">
      <div className="mb-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operations</div>
      <nav className="space-y-1">
        {navItems.map((navItem) => (
          <NavLink
            key={navItem.to}
            to={navItem.to}
            end={navItem.end}
            className={({ isActive }) =>
              cn(
                'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <span className="flex items-center gap-2">
              <navItem.icon className="h-4 w-4 shrink-0" />
              <span>{navItem.label}</span>
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
