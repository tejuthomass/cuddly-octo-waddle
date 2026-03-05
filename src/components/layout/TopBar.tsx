import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { contextId, roleLabel } from '@/lib/auth'
import { defaultPathForRole } from '@/components/common/ProtectedRoute'
import { useTheme } from '@/store/ThemeContext'
import type { AppRole } from '@/types/database'

function compactRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    l1_technician: 'Technician',
    l2_supervisor: 'Supervisor',
    l3_manager: 'Manager',
    l4_management: 'Management',
    l5_admin: 'Admin',
    client_viewer: 'Client',
  }

  return labels[role]
}

export function TopBar() {
  const { user, activeContext, roles, selectOrganization, logout } = useAuth()
  const { data: profile } = useCurrentProfile()
  const { mode, setMode } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminContext = activeContext?.role === 'l5_admin'
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  const contextOptions = useMemo(
    () =>
      roles.map((roleAssignment) => ({
        id: contextId(roleAssignment.clientId, roleAssignment.role),
        clientId: roleAssignment.clientId,
        role: roleAssignment.role,
        label: `${roleAssignment.clientName} · ${roleLabel(roleAssignment.role)}`,
      })),
    [roles],
  )

  const selectedContextId = activeContext ? contextId(activeContext.clientId, activeContext.role) : ''

  const handleContextChange = (value: string) => {
    const selectedOption = contextOptions.find((option) => option.id === value)
    if (!selectedOption) {
      return
    }

    selectOrganization({
      clientId: selectedOption.clientId,
      role: selectedOption.role,
    })

    navigate(defaultPathForRole(selectedOption.role), { replace: true })
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) return
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const userInitials = (profile?.full_name || user?.email || 'User')
    .split('@')[0]
    .split(/[._\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">Facility CMMS</span>
        </div>

        <div className="flex items-center gap-2">
          {!isAdminContext ? (
            <select
              value={selectedContextId}
              onChange={(event) => handleContextChange(event.target.value)}
              className="h-9 max-w-[260px] rounded-md border border-input bg-background px-3 text-xs text-foreground"
              aria-label="Switch organization"
            >
              {contextOptions.map((contextOption) => (
                <option value={contextOption.id} key={contextOption.id}>
                  {contextOption.label}
                </option>
              ))}
            </select>
          ) : null}

          {activeContext ? (
            <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs text-foreground">
              {compactRoleLabel(activeContext.role)}
            </div>
          ) : null}

          <div className="relative" ref={profileMenuRef}>
            <Button variant="outline" size="sm" onClick={() => setProfileMenuOpen((prev) => !prev)} className="gap-2">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile avatar" className="h-5 w-5 rounded-full border border-border object-cover" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">
                  {userInitials || 'U'}
                </span>
              )}
              <ChevronDown className="h-4 w-4" />
            </Button>

            {profileMenuOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-52 rounded-md border border-border bg-popover p-1 shadow-lg">
                <div className="mb-1 rounded px-2 py-1 text-xs text-muted-foreground">Theme</div>
                <div className="mb-2 flex gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => setMode('light')}
                    className={`flex-1 rounded px-2 py-1.5 text-xs ${mode === 'light' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                  >
                    <span className="inline-flex items-center gap-1"><Sun className="h-3.5 w-3.5" />Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('dark')}
                    className={`flex-1 rounded px-2 py-1.5 text-xs ${mode === 'dark' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                  >
                    <span className="inline-flex items-center gap-1"><Moon className="h-3.5 w-3.5" />Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('system')}
                    className={`flex-1 rounded px-2 py-1.5 text-xs ${mode === 'system' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                  >
                    <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />Auto</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    navigate('/settings', { state: { from: `${location.pathname}${location.search}` } })
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    void logout()
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
