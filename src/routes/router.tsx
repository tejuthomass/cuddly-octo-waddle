import { lazy, Suspense } from 'react'
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute, defaultPathForRole } from '@/components/common/ProtectedRoute'
import { RouteSkeleton } from '@/components/common/RouteSkeleton'
import { AppShell } from '@/components/layout/AppShell'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuth } from '@/hooks/useAuth'

const TechnicianHomePage = lazy(() => import('@/features/technician/TechnicianHomePage'))
const TechnicianAssignmentsPage = lazy(() => import('@/features/technician/TechnicianAssignmentsPage'))
const TechnicianInspectionsPage = lazy(() => import('@/features/technician/TechnicianInspectionsPage'))
const TechnicianInspectionFormPage = lazy(() => import('@/features/technician/TechnicianInspectionFormPage'))
const SupervisorHomePage = lazy(() => import('@/features/supervisor/SupervisorHomePage'))
const SupervisorReviewQueuePage = lazy(() => import('@/features/supervisor/SupervisorReviewQueuePage'))
const SupervisorTicketsPage = lazy(() => import('@/features/supervisor/SupervisorTicketsPage'))
const ManagerHomePage = lazy(() => import('@/features/manager/ManagerHomePage'))
const ManagerAssetsPage = lazy(() => import('@/features/manager/ManagerAssetsPage'))
const ManagerTemplatesPage = lazy(() => import('@/features/manager/ManagerTemplatesPage'))
const ManagementHomePage = lazy(() => import('@/features/management/ManagementHomePage'))
const ManagementOverviewPage = lazy(() => import('@/features/management/ManagementOverviewPage'))
const ManagementAbnormalitiesPage = lazy(() => import('@/features/management/ManagementAbnormalitiesPage'))
const AdminHomePage = lazy(() => import('@/features/admin/AdminHomePage'))
const UserManagementPage = lazy(() => import('@/features/admin/UserManagementPage'))
const ClientManagementPage = lazy(() => import('@/features/admin/ClientManagementPage'))
const ClientDetailsPage = lazy(() => import('@/features/admin/ClientDetailsPage'))
const FacilityDetailsPage = lazy(() => import('@/features/admin/FacilityDetailsPage'))
const PasswordResetPage = lazy(() => import('@/features/admin/PasswordResetPage'))
const ActiveSessionsPage = lazy(() => import('@/features/admin/ActiveSessionsPage'))
const AuditLogsPage = lazy(() => import('@/features/admin/AuditLogsPage'))
const ClientHomePage = lazy(() => import('@/features/client/ClientHomePage'))
const ClientOverviewPage = lazy(() => import('@/features/client/ClientOverviewPage'))
const ClientHistoryPage = lazy(() => import('@/features/client/ClientHistoryPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const ChangePasswordPage = lazy(() => import('@/features/settings/ChangePasswordPage'))

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>
}

function TechnicianLayoutFrame() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <div className="pb-20 lg:pb-0">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  )
}

function DesktopLayoutFrame() {
  return <AppShell />
}

function SettingsLayoutFrame() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <Outlet />
    </div>
  )
}

function PostLoginRedirect() {
  const { user, activeContext, isHydrating } = useAuth()

  if (isHydrating) {
    return <RouteSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!activeContext) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={defaultPathForRole(activeContext.role)} replace />
}

function LoginRedirectGuard() {
  const { user, activeContext, isHydrating } = useAuth()

  if (isHydrating) {
    return <RouteSkeleton />
  }

  if (!user) {
    return <LoginPage />
  }

  if (!activeContext) {
    return <LoginPage />
  }

  return <Navigate to={defaultPathForRole(activeContext.role)} replace />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PostLoginRedirect />,
  },
  {
    path: '/login',
    element: <LoginRedirectGuard />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/settings',
        element: <SettingsLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <SettingsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'password',
            element: (
              <LazyRoute>
                <ChangePasswordPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['l1_technician']} />,
    children: [
      {
        path: '/technician',
        element: <TechnicianLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <TechnicianHomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'assignments',
            element: (
              <LazyRoute>
                <TechnicianAssignmentsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'inspections',
            element: (
              <LazyRoute>
                <TechnicianInspectionsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'inspections/:inspectionId',
            element: (
              <LazyRoute>
                <TechnicianInspectionFormPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['l2_supervisor']} />,
    children: [
      {
        path: '/supervisor',
        element: <DesktopLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <SupervisorHomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'reviews',
            element: (
              <LazyRoute>
                <SupervisorReviewQueuePage />
              </LazyRoute>
            ),
          },
          {
            path: 'tickets',
            element: (
              <LazyRoute>
                <SupervisorTicketsPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['l3_manager']} />,
    children: [
      {
        path: '/manager',
        element: <DesktopLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <ManagerHomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'assets',
            element: (
              <LazyRoute>
                <ManagerAssetsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'templates',
            element: (
              <LazyRoute>
                <ManagerTemplatesPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['l4_management']} />,
    children: [
      {
        path: '/management',
        element: <DesktopLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <ManagementHomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'overview',
            element: (
              <LazyRoute>
                <ManagementOverviewPage />
              </LazyRoute>
            ),
          },
          {
            path: 'abnormalities',
            element: (
              <LazyRoute>
                <ManagementAbnormalitiesPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['l5_admin']} />,
    children: [
      {
        path: '/admin',
        element: <DesktopLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <AdminHomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <LazyRoute>
                <UserManagementPage />
              </LazyRoute>
            ),
          },
          {
            path: 'clients',
            element: (
              <LazyRoute>
                <ClientManagementPage />
              </LazyRoute>
            ),
          },
          {
            path: 'clients/:companyId',
            element: (
              <LazyRoute>
                <ClientDetailsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'clients/:companyId/facilities/:facilityId',
            element: (
              <LazyRoute>
                <FacilityDetailsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'password-reset',
            element: (
              <LazyRoute>
                <PasswordResetPage />
              </LazyRoute>
            ),
          },
          {
            path: 'sessions',
            element: (
              <LazyRoute>
                <ActiveSessionsPage />
              </LazyRoute>
            ),
          },
          {
            path: 'logs',
            element: (
              <LazyRoute>
                <AuditLogsPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['client_viewer']} />,
    children: [
      {
        path: '/client',
        element: <DesktopLayoutFrame />,
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <ClientHomePage />
              </LazyRoute>
            ),
          },
          {
            path: 'overview',
            element: (
              <LazyRoute>
                <ClientOverviewPage />
              </LazyRoute>
            ),
          },
          {
            path: 'history',
            element: (
              <LazyRoute>
                <ClientHistoryPage />
              </LazyRoute>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
