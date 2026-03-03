import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthLoadingScreen } from '@/components/common/AuthLoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import type { AppRole } from '@/types/database'

interface ProtectedRouteProps {
  allowedRoles?: AppRole[]
  requiresAuth?: boolean
  allowOrgBypass?: boolean
}

function roleHomePath(role: AppRole): string {
  const map: Record<AppRole, string> = {
    l1_technician: '/technician',
    l2_supervisor: '/supervisor',
    l3_manager: '/manager',
    l4_management: '/management',
    l5_admin: '/admin',
    client_viewer: '/client',
  }

  return map[role]
}

export function ProtectedRoute({ allowedRoles, requiresAuth = true, allowOrgBypass = false }: ProtectedRouteProps) {
  const { isHydrating, user, activeContext, requiresOrganizationSelection } = useAuth()
  const location = useLocation()

  if (isHydrating) {
    return <AuthLoadingScreen />
  }

  if (requiresAuth && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!allowOrgBypass && requiresOrganizationSelection) {
    return <Navigate to="/select-org" replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!activeContext) {
      return <Navigate to="/select-org" replace />
    }

    if (!allowedRoles.includes(activeContext.role)) {
      return <Navigate to={roleHomePath(activeContext.role)} replace />
    }
  }

  return <Outlet />
}

export function defaultPathForRole(role: AppRole): string {
  return roleHomePath(role)
}
