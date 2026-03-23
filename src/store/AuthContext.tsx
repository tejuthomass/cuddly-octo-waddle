import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getContextStorageKey, rolePriority } from '@/lib/auth'
import { toHumanErrorMessage } from '@/lib/errors'
import type { ActiveOrganizationContext, AuthContextValue, RoleAssignment } from '@/types/auth'
import type { AppRole } from '@/types/database'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const SESSION_MISMATCH_MESSAGE = 'You were signed out because your account was used in a newer session.'
const SESSION_TOAST_ID = 'session-mismatch'
const SESSION_EXPIRY_HOURS = 24
const SESSION_INACTIVITY_CHECK_INTERVAL = 60_000 // 1 minute  
const SESSION_LAST_SEEN_UPDATE_INTERVAL = 300_000 // 5 minutes
const NO_ROLES_TOAST_ID = 'no-assigned-roles'
const SESSION_EXPIRED_TOAST_ID = 'session-expired'

interface AuthProviderProps {
  children: React.ReactNode
}

interface UserRoleSelectRow {
  client_id: string
  role: AppRole
  is_active: boolean
  clients: Array<{
    name: string
  }> | null
}

interface AdminRoleSelectRow {
  role_code: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'CLIENT'
  role_title: string
  is_active: boolean
}

function parseStoredContext(rawValue: string | null): ActiveOrganizationContext | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ActiveOrganizationContext>
    if (!parsed.clientId || !parsed.role) {
      return null
    }

    return {
      clientId: parsed.clientId,
      role: parsed.role,
    }
  } catch {
    return null
  }
}

function sortRoles(assignments: RoleAssignment[]): RoleAssignment[] {
  return [...assignments].sort((a, b) => {
    const priorityDelta = rolePriority[a.role] - rolePriority[b.role]
    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return a.clientName.localeCompare(b.clientName)
  })
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<RoleAssignment[]>([])
  const [activeContext, setActiveContext] = useState<ActiveOrganizationContext | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const latestTokenRef = useRef<string | null>(null)
  const lastSessionHeartbeatRef = useRef(0)

  const isSessionExpiredByLastSeen = useCallback((lastSeen: string | null | undefined) => {
    if (!lastSeen) {
      return false
    }

    const seenAt = new Date(lastSeen).getTime()
    if (Number.isNaN(seenAt)) {
      return false
    }

    const maxAgeMs = SESSION_EXPIRY_HOURS * 60 * 60 * 1000
    return Date.now() - seenAt > maxAgeMs
  }, [])

  const fetchRoles = useCallback(async (userId: string): Promise<RoleAssignment[]> => {
    const roleCodeToAppRole = (code: string): AppRole | null => {
      const map: Record<string, AppRole> = {
        'L1': 'l1_technician',
        'L2': 'l2_supervisor',
        'L3': 'l3_manager',
        'L4': 'l4_management',
        'L5': 'l5_admin',
        'CLIENT': 'client_viewer',
      }
      return map[code] ?? null
    }

    // Query legacy roles
    const { data: legacyData, error: legacyError } = await supabase
      .from('user_roles')
      .select('client_id, role, is_active, clients(name)')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (legacyError) {
      throw legacyError
    }

    const legacyRows = (legacyData ?? []) as UserRoleSelectRow[]
    const legacyMapped = legacyRows.map((row) => ({
      clientId: row.client_id,
      clientName: row.clients?.[0]?.name ?? 'Unnamed client',
      role: row.role,
    }))

    // Query admin roles (new system)
    const { data: adminData, error: adminError } = await supabase
      .from('user_role_assignments')
      .select('role_code, role_title, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)

    if (adminError) {
      throw adminError
    }

    const adminRows = (adminData ?? []) as AdminRoleSelectRow[]
    const adminMapped = adminRows
      .map((row) => {
        const appRole = roleCodeToAppRole(row.role_code)
        if (!appRole) return null

        return {
          clientId: 'admin-system',
          clientName: 'Admin Panel',
          role: appRole,
        }
      })
      .filter((item) => item !== null)

    // Combine both sources; admin roles take precedence
    const allRoles = [...adminMapped, ...legacyMapped]

    return sortRoles(allRoles)
  }, [])

  const fetchRolesWithRetry = useCallback(async (userId: string, maxRetries = 2): Promise<RoleAssignment[]> => {
    let attempt = 0
    let lastError: unknown = null

    while (attempt <= maxRetries) {
      try {
        return await fetchRoles(userId)
      } catch (error) {
        lastError = error
        attempt += 1

        if (attempt > maxRetries) {
          break
        }

        await new Promise((resolve) => window.setTimeout(resolve, 400 * attempt))
      }
    }

    throw lastError
  }, [fetchRoles])

  const clearLocalAuthState = useCallback(() => {
    setSession(null)
    setUser(null)
    setRoles([])
    setActiveContext(null)
    setIsHydrating(false)
    latestTokenRef.current = null
  }, [])

  const forceSignOutForSessionMismatch = useCallback(async (userId: string) => {
    latestTokenRef.current = null
    localStorage.removeItem(getContextStorageKey(userId))
    await supabase.auth.signOut()
    clearLocalAuthState()
    toast.error(SESSION_MISMATCH_MESSAGE, { id: SESSION_TOAST_ID })
  }, [clearLocalAuthState])

  const forceSignOutForExpiredSession = useCallback(async (userId: string) => {
    latestTokenRef.current = null
    localStorage.removeItem(getContextStorageKey(userId))
    await supabase.auth.signOut()
    clearLocalAuthState()
    toast.error(`Session expired after ${SESSION_EXPIRY_HOURS}h of inactivity. Please sign in again.`, { id: SESSION_EXPIRED_TOAST_ID })
  }, [clearLocalAuthState])

  const heartbeatActiveSession = useCallback(async (nextUser: User, nextToken: string) => {
    const now = Date.now()
    if (now - lastSessionHeartbeatRef.current < SESSION_LAST_SEEN_UPDATE_INTERVAL) {
      return
    }

    const { error } = await supabase
      .from('active_sessions')
      .update({
        last_seen: new Date().toISOString(),
      })
      .eq('user_id', nextUser.id)
      .eq('session_token', nextToken)

    if (!error) {
      lastSessionHeartbeatRef.current = now
    }
  }, [])

  const persistContext = useCallback((userId: string, nextContext: ActiveOrganizationContext | null) => {
    const storageKey = getContextStorageKey(userId)

    if (!nextContext) {
      localStorage.removeItem(storageKey)
      return
    }

    localStorage.setItem(storageKey, JSON.stringify(nextContext))
  }, [])

  const resolveInitialContext = useCallback(
    (nextUser: User, roleAssignments: RoleAssignment[]): ActiveOrganizationContext | null => {
      if (roleAssignments.length === 0) {
        return null
      }

      const persistedContext = parseStoredContext(localStorage.getItem(getContextStorageKey(nextUser.id)))
      if (persistedContext) {
        const exists = roleAssignments.some(
          (roleAssignment) =>
            roleAssignment.clientId === persistedContext.clientId && roleAssignment.role === persistedContext.role,
        )

        if (exists) {
          return persistedContext
        }
      }

      const defaultRole = roleAssignments[0]
      return { clientId: defaultRole.clientId, role: defaultRole.role }
    },
    [],
  )

  const claimActiveSession = useCallback(async (nextUser: User, nextSession: Session) => {
    const nextToken = nextSession.access_token

    const { data: updatedRows, error: updateError } = await supabase
      .from('active_sessions')
      .update({
        session_token: nextToken,
        last_seen: new Date().toISOString(),
      })
      .eq('user_id', nextUser.id)
      .select('user_id')

    if (updateError) {
      throw updateError
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await supabase.from('active_sessions').insert({
        user_id: nextUser.id,
        session_token: nextToken,
        last_seen: new Date().toISOString(),
      })

      if (insertError) {
        throw insertError
      }
    }

    return true
  }, [])

  const rotateRefreshedSessionToken = useCallback(async (nextUser: User, nextToken: string, previousToken: string | null) => {
    if (!previousToken) {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('session_token')
        .eq('user_id', nextUser.id)
        .maybeSingle<{ session_token: string }>()

      if (error) {
        throw error
      }

      if (!data?.session_token) {
        const { error: insertError } = await supabase.from('active_sessions').insert({
          user_id: nextUser.id,
          session_token: nextToken,
          last_seen: new Date().toISOString(),
        })

        if (insertError) {
          throw insertError
        }

        return true
      }

      if (data.session_token === nextToken) {
        return true
      }

      await forceSignOutForSessionMismatch(nextUser.id)
      return false
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('active_sessions')
      .update({
        session_token: nextToken,
        last_seen: new Date().toISOString(),
      })
      .eq('user_id', nextUser.id)
      .eq('session_token', previousToken)
      .select('user_id')

    if (updateError) {
      throw updateError
    }

    if (!updatedRows || updatedRows.length === 0) {
      await forceSignOutForSessionMismatch(nextUser.id)
      return false
    }

    return true
  }, [forceSignOutForSessionMismatch])

  const validateCurrentSession = useCallback(async (nextUser: User, nextSession: Session) => {
    const nextToken = nextSession.access_token

    const { data, error } = await supabase
      .from('active_sessions')
      .select('session_token,last_seen')
      .eq('user_id', nextUser.id)
      .maybeSingle<{ session_token: string; last_seen: string | null }>()

    if (error) {
      throw error
    }

    if (!data?.session_token) {
      return true
    }

    if (isSessionExpiredByLastSeen(data.last_seen)) {
      await forceSignOutForExpiredSession(nextUser.id)
      return false
    }

    if (data.session_token === nextToken) {
      return true
    }

    await forceSignOutForSessionMismatch(nextUser.id)
    return false
  }, [forceSignOutForExpiredSession, forceSignOutForSessionMismatch, isSessionExpiredByLastSeen])

  const hydrateUserState = useCallback(
    async (
      nextSession: Session | null,
      nextUser: User | null,
      options?: {
        claimSession?: boolean
      },
    ): Promise<void> => {
      if (!nextSession || !nextUser) {
        clearLocalAuthState()
        return
      }

      if (options?.claimSession) {
        await claimActiveSession(nextUser, nextSession)
      } else {
        const sessionIsValid = await validateCurrentSession(nextUser, nextSession)
        if (!sessionIsValid) {
          return
        }
      }

      const roleAssignments = await fetchRolesWithRetry(nextUser.id)
      if (roleAssignments.length === 0) {
        // User has no roles - sign them out with a clear message
        latestTokenRef.current = null
        await supabase.auth.signOut()
        clearLocalAuthState()
        toast.error('Your account has no assigned roles. Contact an administrator.', { id: NO_ROLES_TOAST_ID })
        return
      }

      const initialContext = resolveInitialContext(nextUser, roleAssignments)

      setSession(nextSession)
      setUser(nextUser)
      setRoles(roleAssignments)
      setActiveContext(initialContext)
      persistContext(nextUser.id, initialContext)
    },
    [clearLocalAuthState, claimActiveSession, fetchRolesWithRetry, persistContext, resolveInitialContext, validateCurrentSession],
  )

  const refreshRoles = useCallback(async (silent = false) => {
    if (!user) {
      return
    }

    try {
      const roleAssignments = await fetchRolesWithRetry(user.id)

      if (roleAssignments.length === 0) {
        latestTokenRef.current = null
        await supabase.auth.signOut()
        clearLocalAuthState()
        toast.error('Your account has no assigned roles. Contact an administrator.', { id: NO_ROLES_TOAST_ID })
        return
      }

      setRoles(roleAssignments)

      if (!activeContext) {
        if (roleAssignments.length > 0) {
          const nextContext = { clientId: roleAssignments[0].clientId, role: roleAssignments[0].role }
          setActiveContext(nextContext)
          persistContext(user.id, nextContext)
        }

        return
      }

      const stillValid = roleAssignments.some(
        (roleAssignment) =>
          roleAssignment.clientId === activeContext.clientId && roleAssignment.role === activeContext.role,
      )

      if (!stillValid) {
        const nextContext = roleAssignments[0]
          ? { clientId: roleAssignments[0].clientId, role: roleAssignments[0].role }
          : null

        setActiveContext(nextContext)
        persistContext(user.id, nextContext)
      }
    } catch (error) {
      if (!silent) {
        toast.error(toHumanErrorMessage(error, 'Unable to refresh role assignments.'))
      }
    }
  }, [activeContext, clearLocalAuthState, fetchRolesWithRetry, persistContext, user])

  const login = useCallback(async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim()
    let email = normalizedIdentifier.toLowerCase()

    if (!normalizedIdentifier.includes('@')) {
      const { data, error: resolveError } = await supabase.rpc('resolve_login_email', {
        p_employee_id: normalizedIdentifier,
      })

      if (resolveError) {
        throw resolveError
      }

      if (!data || typeof data !== 'string') {
        throw new Error('Invalid login credentials.')
      }

      email = data.toLowerCase()
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error('Invalid login credentials.')
    }
  }, [])

  const logout = useCallback(async () => {
    if (user) {
      await supabase.from('active_sessions').delete().eq('user_id', user.id)
      localStorage.removeItem(getContextStorageKey(user.id))
    }

    latestTokenRef.current = null
    await supabase.auth.signOut()
    clearLocalAuthState()
  }, [clearLocalAuthState, user])

  const selectOrganization = useCallback(
    (context: ActiveOrganizationContext) => {
      if (!user) {
        return
      }

      setActiveContext(context)
      persistContext(user.id, context)
    },
    [persistContext, user],
  )

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      setIsHydrating(true)

      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          toast.error(toHumanErrorMessage(error, 'Failed to restore your session.'))
          if (active) {
            clearLocalAuthState()
          }
          return
        }

        if (active) {
          await hydrateUserState(data.session, data.session?.user ?? null, { claimSession: false })
        }
      } catch (error) {
        toast.error(toHumanErrorMessage(error, 'Failed to initialize authentication.'))
        if (active) {
          clearLocalAuthState()
        }
      } finally {
        if (active) {
          setIsHydrating(false)
        }
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        clearLocalAuthState()
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const nextToken = nextSession?.access_token ?? null
        const nextUser = nextSession?.user ?? null
        const previousToken = latestTokenRef.current
        const hadToken = Boolean(previousToken)
        const shouldHydrate = event === 'SIGNED_IN' && !hadToken

        latestTokenRef.current = nextToken
        if (shouldHydrate) {
          setIsHydrating(true)
        }
        const refreshFlow = async () => {
          if (event === 'TOKEN_REFRESHED' && nextSession && nextUser) {
            const rotated = await rotateRefreshedSessionToken(nextUser, nextSession.access_token, previousToken)
            if (!rotated) {
              return
            }

            setSession(nextSession)
            setUser(nextUser)
            return
          }

          await hydrateUserState(nextSession, nextUser, { claimSession: event === 'SIGNED_IN' })
        }

        void refreshFlow()
          .catch((error) => {
            toast.error(toHumanErrorMessage(error, 'Unable to restore your authenticated session.'))
            clearLocalAuthState()
          })
          .finally(() => {
            if (shouldHydrate) {
              setIsHydrating(false)
            }
          })
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [clearLocalAuthState, hydrateUserState])

  useEffect(() => {
    if (!session || !user) {
      return
    }

    let active = true

    const runValidation = async () => {
      if (!active) {
        return
      }

      try {
        const valid = await validateCurrentSession(user, session)
        if (!valid) {
          return
        }
      } catch (error) {
        toast.error(toHumanErrorMessage(error, 'Failed to validate active session.'))
      }
    }

    const onActivity = () => {
      void heartbeatActiveSession(user, session.access_token)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runValidation()
        void refreshRoles(true)
      }
    }

    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('touchstart', onActivity)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runValidation()
      }
    }, SESSION_INACTIVITY_CHECK_INTERVAL)

    return () => {
      active = false
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('touchstart', onActivity)
      window.clearInterval(intervalId)
    }
  }, [heartbeatActiveSession, refreshRoles, session, user, validateCurrentSession])

  useEffect(() => {
    if (!session || !user) {
      return
    }

    const channel = supabase
      .channel(`active-session-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const token =
            payload.eventType === 'DELETE'
              ? null
              : ((payload.new as { session_token?: string } | null)?.session_token ?? null)

          const localToken = latestTokenRef.current

          if (!localToken) {
            return
          }

          if (!token || token !== localToken) {
            void forceSignOutForSessionMismatch(user.id)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [forceSignOutForSessionMismatch, user])

  useEffect(() => {
    latestTokenRef.current = session?.access_token ?? null
  }, [session])

  const requiresOrganizationSelection = Boolean(user && roles.length > 1 && !activeContext)

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      roles,
      activeContext,
      isHydrating,
      requiresOrganizationSelection,
      login,
      logout,
      refreshRoles,
      selectOrganization,
    }),
    [activeContext, isHydrating, login, logout, refreshRoles, requiresOrganizationSelection, roles, session, user],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
