import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/types/database'

interface SidebarProps {
  role: AppRole
}

interface NavItem {
  label: string
  to: string
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
        end: true,
      },
      {
        label: 'User Management',
        to: '/admin/users',
      },
      {
        label: 'Role Assignment',
        to: '/admin/roles',
      },
      {
        label: 'Client Management',
        to: '/admin/clients',
      },
      {
        label: 'Password Reset',
        to: '/admin/password-reset',
      },
      {
        label: 'Active Sessions',
        to: '/admin/sessions',
      },
    ]
  }

  if (role === 'l3_manager') {
    return [
      {
        label: 'Dashboard',
        to: '/manager',
        end: true,
      },
      {
        label: 'Asset Management',
        to: '/manager/assets',
      },
      {
        label: 'Form Builder',
        to: '/manager/templates',
      },
    ]
  }

  if (role === 'l2_supervisor') {
    return [
      {
        label: 'Dashboard',
        to: '/supervisor',
        end: true,
      },
      {
        label: 'Review Queue',
        to: '/supervisor/reviews',
      },
      {
        label: 'Abnormality Tickets',
        to: '/supervisor/tickets',
      },
    ]
  }

  if (role === 'l4_management') {
    return [
      {
        label: 'Dashboard',
        to: '/management',
        end: true,
      },
      {
        label: 'KPI Overview',
        to: '/management/overview',
      },
      {
        label: 'Abnormalities',
        to: '/management/abnormalities',
      },
    ]
  }

  if (role === 'client_viewer') {
    return [
      {
        label: 'Dashboard',
        to: '/client',
        end: true,
      },
      {
        label: 'Overview',
        to: '/client/overview',
      },
      {
        label: 'History',
        to: '/client/history',
      },
    ]
  }

  return [
    {
      label: 'Dashboard',
      to: defaultDashboard[role],
      end: true,
    },
  ]
}

export function Sidebar({ role }: SidebarProps) {
  const navItems = navItemsByRole(role)

  return (
    <aside className="hidden w-64 border-r border-border/70 bg-card/60 px-4 py-6 lg:block">
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
            {navItem.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
