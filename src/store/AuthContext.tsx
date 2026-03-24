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
const ACCOUNT_DEACTIVATED_MESSAGE = 'Your account has been deactivated. Please contact an administrator.'
const ACCOUNT_DEACTIVATED_TOAST_ID = 'account-deactivated'

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

  const fetchRoles = useCallback(async (userId: string): Promise<RoleAssignment[]> => {
    // Legacy system check
    const { data: legacyData, error: legacyError } = await supabase
      .from('user_roles')
      .select('client_id, role, is_active, clients(name)')
      .eq('user_id', userId)
      .eq('is_active', true)

    let rows = ((legacyData ?? []) as UserRoleSelectRow[]).map((row) => ({
      clientId: row.client_id,
      clientName: row.clients?.[0]?.name ?? 'Unnamed client',
      role: row.role,
    }))

    // In parallel or fallback, check new admin domain system `user_role_assignments`
    // because L5/L4 or newly added users may only exist there.
    if (rows.length === 0) {
      const { data: newRoles, error: newError } = await supabase
        .from('user_role_assignments')
        .select('role_code')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (!newError && newRoles && newRoles.length > 0) {
        const roleMap: Record<string, AppRole> = {
          L1: 'l1_technician',
          L2: 'l2_supervisor',
          L3: 'l3_manager',
          L4: 'l4_management',
          L5: 'l5_admin',
          CLIENT: 'client_viewer',
        }
        
        const mappedRole = roleMap[newRoles[0].role_code] || 'l1_technician'
        
        // Attempt to get companies if they are assigned any
        const { data: companies } = await supabase
          .from('user_companies')
          .select('company_id, companies(company_name)')
          .eq('user_id', userId)
          .eq('is_active', true)

        if (companies && companies.length > 0) {
          rows = companies.map(uc => ({
            clientId: uc.company_id,
            clientName: (Array.isArray(uc.companies) ? uc.companies[0]?.company_name : (uc.companies as any)?.company_name) ?? 'Unnamed Company',
            role: mappedRole
          }))
        } else {
          // If no mapped companies but they have a global role like L5, give them a system context.
          rows = [{
            clientId: 'system',
            clientName: 'Global System',
            role: mappedRole
          }]
        }
      }
    }

    return sortRoles(rows)
  }, [])

  const clearLocalAuthState = useCallback(() => {
    setSession(null)
    setUser(null)
    setRoles([])
    setActiveContext(null)
    setIsHydrating(false)
    latestTokenRef.current = null
  }, [])

  const forceSignOutForSessionMismatch = useCallback(async (userId: string) => {
    localStorage.removeItem(getContextStorageKey(userId))
    await supabase.auth.signOut()
    clearLocalAuthState()
    toast.error(SESSION_MISMATCH_MESSAGE, { id: SESSION_TOAST_ID })
  }, [clearLocalAuthState])

  const forceSignOutForDeactivatedAccount = useCallback(async (userId: string) => {
    localStorage.removeItem(getContextStorageKey(userId))
    await supabase.auth.signOut()
    clearLocalAuthState()
    toast.error(ACCOUNT_DEACTIVATED_MESSAGE, { id: ACCOUNT_DEACTIVATED_TOAST_ID })
  }, [clearLocalAuthState])

  const validateUserIsActive = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .maybeSingle<{ is_active: boolean }>()

    if (error) {
      throw error
    }

    if (!data || data.is_active === false) {
      await forceSignOutForDeactivatedAccount(userId)
      return false
    }

    return true
  }, [forceSignOutForDeactivatedAccount])

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
    const isActive = await validateUserIsActive(nextUser.id)
    if (!isActive) {
      return false
    }

    const nextToken = nextSession.access_token

    const { data, error } = await supabase
      .from('active_sessions')
      .select('session_token')
      .eq('user_id', nextUser.id)
      .maybeSingle<{ session_token: string }>()

    if (error) {
      throw error
    }

    if (!data?.session_token) {
      return true
    }

    if (data.session_token === nextToken) {
      return true
    }

    await forceSignOutForSessionMismatch(nextUser.id)
    return false
  }, [forceSignOutForSessionMismatch, validateUserIsActive])

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

      const isActive = await validateUserIsActive(nextUser.id)
      if (!isActive) {
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

      const roleAssignments = await fetchRoles(nextUser.id)
      if (roleAssignments.length === 0) {
        await supabase.auth.signOut()
        clearLocalAuthState()
        return
      }

      const initialContext = resolveInitialContext(nextUser, roleAssignments)

      setSession(nextSession)
      setUser(nextUser)
      setRoles(roleAssignments)
      setActiveContext(initialContext)
      persistContext(nextUser.id, initialContext)
    },
    [clearLocalAuthState, claimActiveSession, fetchRoles, persistContext, resolveInitialContext, validateCurrentSession, validateUserIsActive],
  )

  const refreshRoles = useCallback(async () => {
    if (!user) {
      return
    }

    try {
      const roleAssignments = await fetchRoles(user.id)
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
      toast.error(toHumanErrorMessage(error, 'Unable to refresh role assignments.'))
    }
  }, [activeContext, fetchRoles, persistContext, user])

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
        await validateCurrentSession(user, session)
      } catch (error) {
        toast.error(toHumanErrorMessage(error, 'Failed to validate active session.'))
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runValidation()
      }
    }, 300_000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [session, user, validateCurrentSession])

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
    if (!user) {
      return
    }

    const channel = supabase
      .channel(`profile-active-state-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            void forceSignOutForDeactivatedAccount(user.id)
            return
          }

          const nextIsActive = (payload.new as { is_active?: boolean } | null)?.is_active
          if (nextIsActive === false) {
            void forceSignOutForDeactivatedAccount(user.id)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [forceSignOutForDeactivatedAccount, user])

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
