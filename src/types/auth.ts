import type { Session, User } from '@supabase/supabase-js'
import type { AppRole } from './database'

export interface RoleAssignment {
  clientId: string
  clientName: string
  role: AppRole
}

export interface ActiveOrganizationContext {
  clientId: string
  role: AppRole
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  roles: RoleAssignment[]
  activeContext: ActiveOrganizationContext | null
  isHydrating: boolean
  requiresOrganizationSelection: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshRoles: () => Promise<void>
  selectOrganization: (context: ActiveOrganizationContext) => void
}
