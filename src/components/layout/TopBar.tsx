import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { contextId, roleLabel } from '@/lib/auth'
import { defaultPathForRole } from '@/components/common/ProtectedRoute'

export function TopBar() {
  const { activeContext, roles, selectOrganization, logout } = useAuth()
  const navigate = useNavigate()
  const isSuperAdminContext = activeContext?.role === 'l5_admin'

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

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">Facility CMMS</span>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdminContext ? (
            <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs text-foreground">
              Super Admin
            </div>
          ) : (
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
          )}

          <Button variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>

          <Button variant="outline" size="sm" onClick={() => navigate('/settings/password')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
    </header>
  )
}
